import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Library | Perplexify - Your Conversation History',
  description: 'Access and manage all your conversations with Perplexify AI assistant. Search, organize, and revisit your chat history.',
  keywords: ['conversation history', 'chat library', 'AI assistant', 'perplexity alternative'],
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
};

export default Layout;
