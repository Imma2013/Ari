import axios from 'axios';
import { htmlToText } from 'html-to-text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import pdfParse from 'pdf-parse';

export const getDocumentsFromLinks = async ({ links }: { links: string[] }) => {
  // Optimized text splitter - larger chunks, less splitting
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 3000, // Much larger chunks (vs default ~1000)
    chunkOverlap: 200, // Reasonable overlap
    separators: ['\n\n', '\n', '. ', ' ', ''], // Better separators
  });

  let docs: Document[] = [];
  const maxDocumentsPerUrl = 3; // Limit documents per URL
  const requestTimeout = 8000; // 8 second timeout

  // URL filtering - skip problematic domains
  const problematicDomains = [
    'linkedin.com',
    'facebook.com', 
    'twitter.com',
    'x.com',
    'instagram.com',
    'pinterest.com',
    'reddit.com'
  ];

  const validLinks = links.filter(link => {
    try {
      const url = new URL(link.startsWith('http') ? link : `https://${link}`);
      return !problematicDomains.some(domain => url.hostname.includes(domain));
    } catch {
      return false;
    }
  });

  console.log(`📋 Filtered URLs: ${links.length} → ${validLinks.length} (removed ${links.length - validLinks.length} problematic URLs)`);

  await Promise.all(
    validLinks.map(async (link) => {
      link =
        link.startsWith('http://') || link.startsWith('https://')
          ? link
          : `https://${link}`;

      try {
        const res = await axios.get(link, {
          responseType: 'arraybuffer',
          timeout: requestTimeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          maxRedirects: 3,
          validateStatus: (status) => status < 400, // Only accept successful responses
        });

        const isPdf = res.headers['content-type'] === 'application/pdf';

        if (isPdf) {
          const pdfText = await pdfParse(res.data);
          const parsedText = pdfText.text
            .replace(/(\r\n|\n|\r)/gm, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          const splittedText = await splitter.splitText(parsedText);
          const title = 'PDF Document';

          // Limit chunks per PDF
          const limitedChunks = splittedText.slice(0, maxDocumentsPerUrl);
          const linkDocs = limitedChunks.map((text, index) => {
            return new Document({
              pageContent: text,
              metadata: {
                title: `${title} (Part ${index + 1})`,
                url: link,
                type: 'pdf',
                chunkIndex: index,
              },
            });
          });

          docs.push(...linkDocs);
          return;
        }

        const parsedText = htmlToText(res.data.toString('utf8'), {
          selectors: [
            {
              selector: 'a',
              options: {
                ignoreHref: true,
              },
            },
          ],
        })
          .replace(/(\r\n|\n|\r)/gm, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Skip if content is too short
        if (parsedText.length < 200) {
          console.log(`⚠️ Skipping ${link} - content too short (${parsedText.length} chars)`);
          return;
        }

        const splittedText = await splitter.splitText(parsedText);
        const title = res.data
          .toString('utf8')
          .match(/<title.*>(.*?)<\/title>/)?.[1];

        // CRITICAL FIX: Limit chunks per URL to prevent explosion
        const limitedChunks = splittedText.slice(0, maxDocumentsPerUrl);
        const linkDocs = limitedChunks.map((text, index) => {
          return new Document({
            pageContent: text,
            metadata: {
              title: title ? `${title}${limitedChunks.length > 1 ? ` (Part ${index + 1})` : ''}` : link,
              url: link,
              type: 'html',
              chunkIndex: index,
              totalChunks: limitedChunks.length,
              contentLength: text.length,
            },
          });
        });

        docs.push(...linkDocs);
      } catch (err: any) {
        // Better error handling - don't spam logs for expected errors
        const isExpectedError = err.code === 'ENOTFOUND' || 
                               err.response?.status === 403 || 
                               err.response?.status === 999 ||
                               err.code === 'ETIMEDOUT';
        
        if (!isExpectedError) {
          console.error(`❌ Error fetching ${link}:`, err.message);
        }
        
        // Don't create error documents - just skip failed URLs
        return;
      }
    }),
  );

  console.log(`✅ Document extraction completed: ${docs.length} documents from ${validLinks.length} URLs`);
  console.log(`📊 Extraction efficiency: ${validLinks.length} URLs → ${docs.length} documents (${Math.round((docs.length / validLinks.length) * 100)}% ratio)`);
  
  // CRITICAL: Deduplication to remove duplicate content
  const deduplicatedDocs = deduplicateDocuments(docs);
  console.log(`🔄 Deduplication: ${docs.length} → ${deduplicatedDocs.length} documents (removed ${docs.length - deduplicatedDocs.length} duplicates)`);
  
  return deduplicatedDocs;
};

// Deduplication function to remove duplicate documents
function deduplicateDocuments(docs: Document[]): Document[] {
  const seen = new Set<string>();
  const contentHashes = new Map<string, Document>();
  const urlSet = new Set<string>();
  
  return docs.filter(doc => {
    // Method 1: URL deduplication (same URL)
    const url = doc.metadata?.url;
    if (url && urlSet.has(url)) {
      // Keep the longer document if same URL
      const existing = Array.from(contentHashes.values()).find(d => d.metadata?.url === url);
      if (existing && doc.pageContent.length > existing.pageContent.length) {
        // Replace with longer version
        contentHashes.delete(getContentHash(existing.pageContent));
        urlSet.delete(url);
      } else {
        return false; // Skip shorter version
      }
    }
    
    // Method 2: Content similarity deduplication
    const contentHash = getContentHash(doc.pageContent);
    const normalizedContent = normalizeContent(doc.pageContent);
    
    // Check for exact content matches
    if (seen.has(contentHash)) {
      return false;
    }
    
    // Check for near-duplicate content (80% similar)
    for (const [existingHash, existingDoc] of contentHashes) {
      if (isSimilarContent(normalizedContent, normalizeContent(existingDoc.pageContent))) {
        // Keep the longer, more informative document
        if (doc.pageContent.length > existingDoc.pageContent.length) {
          contentHashes.delete(existingHash);
          seen.delete(existingHash);
        } else {
          return false;
        }
      }
    }
    
    // Add to tracking sets
    seen.add(contentHash);
    contentHashes.set(contentHash, doc);
    if (url) urlSet.add(url);
    
    return true;
  });
}

// Generate content hash for exact duplicate detection
function getContentHash(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim().toLowerCase();
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

// Normalize content for similarity comparison
function normalizeContent(content: string): string {
  return content
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .toLowerCase()
    .trim();
}

// Check if two pieces of content are similar (80% threshold)
function isSimilarContent(content1: string, content2: string): boolean {
  if (Math.abs(content1.length - content2.length) > Math.max(content1.length, content2.length) * 0.3) {
    return false; // Too different in length
  }
  
  const words1 = content1.split(/\s+/);
  const words2 = content2.split(/\s+/);
  
  if (words1.length < 10 || words2.length < 10) {
    return content1 === content2; // Exact match for short content
  }
  
  // Calculate Jaccard similarity (intersection over union)
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(word => set2.has(word)));
  const union = new Set([...set1, ...set2]);
  
  const similarity = intersection.size / union.size;
  return similarity >= 0.8; // 80% similarity threshold
}
