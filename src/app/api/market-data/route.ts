import { NextRequest, NextResponse } from 'next/server';

// Types for better type safety
interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  volume?: number;
}

interface CryptoData {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
}

interface ForexData {
  pair: string;
  rate: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

interface MarketSentiment {
  fearGreedIndex: number;
  sentiment: string;
  timestamp: string;
}

class MarketDataService {
  private static instance: MarketDataService;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  private isValidCache(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.CACHE_DURATION;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private getCache(key: string): any {
    const cached = this.cache.get(key);
    return cached?.data;
  }

  async fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async fetchStockData(): Promise<StockData[]> {
    const cacheKey = 'stocks';
    if (this.isValidCache(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      // Using Yahoo Finance query API (public endpoint)
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'INTC'];
      const symbolsParam = symbols.join(',');
      
      // Alternative: Use Yahoo Finance quote API
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolsParam}`;
      
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const stocks: StockData[] = data.quoteResponse?.result?.map((quote: any) => ({
        symbol: quote.symbol || 'N/A',
        name: quote.longName || quote.shortName || quote.symbol,
        price: quote.regularMarketPrice || 0,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        marketCap: quote.marketCap,
        volume: quote.regularMarketVolume
      })) || [];

      this.setCache(cacheKey, stocks);
      return stocks;
    } catch (error) {
      console.error('Error fetching stock data:', error);
      // Fallback mock data
      return this.getMockStockData();
    }
  }

  async fetchCryptoData(limit: number = 10): Promise<CryptoData[]> {
    const cacheKey = `crypto_${limit}`;
    if (this.isValidCache(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      // CoinGecko public API (no key required)
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;
      
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const cryptoData = await response.json();
      this.setCache(cacheKey, cryptoData);
      return cryptoData;
    } catch (error) {
      console.error('Error fetching crypto data:', error);
      return this.getMockCryptoData();
    }
  }

  async fetchForexData(): Promise<ForexData[]> {
    const cacheKey = 'forex';
    if (this.isValidCache(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      // Using exchangerate-api.com (free tier, no key required for basic usage)
      const baseCurrency = 'USD';
      const url = `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;
      
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convert to our format with major currency pairs
      const majorPairs = ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR'];
      const forexData: ForexData[] = majorPairs.map(currency => ({
        pair: `USD/${currency}`,
        rate: data.rates[currency] || 0,
        change: 0, // This API doesn't provide change data
        changePercent: 0,
        timestamp: data.date
      }));

      this.setCache(cacheKey, forexData);
      return forexData;
    } catch (error) {
      console.error('Error fetching forex data:', error);
      return this.getMockForexData();
    }
  }

  async fetchMarketSentiment(): Promise<MarketSentiment> {
    const cacheKey = 'sentiment';
    if (this.isValidCache(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      // Alternative API for Fear & Greed Index
      const url = 'https://api.alternative.me/fng/';
      
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const sentiment: MarketSentiment = {
        fearGreedIndex: parseInt(data.data[0]?.value) || 50,
        sentiment: data.data[0]?.value_classification || 'Neutral',
        timestamp: data.data[0]?.timestamp || new Date().toISOString()
      };

      this.setCache(cacheKey, sentiment);
      return sentiment;
    } catch (error) {
      console.error('Error fetching market sentiment:', error);
      return this.getMockSentimentData();
    }
  }

  // Mock data fallbacks
  private getMockStockData(): StockData[] {
    return [
      { symbol: 'AAPL', name: 'Apple Inc.', price: 175.43, change: 2.15, changePercent: 1.24 },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 2845.32, change: -12.45, changePercent: -0.44 },
      { symbol: 'MSFT', name: 'Microsoft Corporation', price: 384.25, change: 5.67, changePercent: 1.50 },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 3456.78, change: -25.43, changePercent: -0.73 },
      { symbol: 'TSLA', name: 'Tesla Inc.', price: 245.67, change: 12.34, changePercent: 5.29 }
    ];
  }

  private getMockCryptoData(): CryptoData[] {
    return [
      {
        id: 'bitcoin',
        name: 'Bitcoin',
        symbol: 'btc',
        current_price: 45250.32,
        price_change_24h: 1250.45,
        price_change_percentage_24h: 2.84,
        market_cap: 885000000000,
        total_volume: 28500000000
      },
      {
        id: 'ethereum',
        name: 'Ethereum',
        symbol: 'eth',
        current_price: 2845.67,
        price_change_24h: -45.23,
        price_change_percentage_24h: -1.57,
        market_cap: 342000000000,
        total_volume: 15200000000
      }
    ];
  }

  private getMockForexData(): ForexData[] {
    return [
      { pair: 'USD/EUR', rate: 0.85, change: 0.002, changePercent: 0.24, timestamp: new Date().toISOString() },
      { pair: 'USD/GBP', rate: 0.73, change: -0.001, changePercent: -0.14, timestamp: new Date().toISOString() },
      { pair: 'USD/JPY', rate: 149.85, change: 0.45, changePercent: 0.30, timestamp: new Date().toISOString() }
    ];
  }

  private getMockSentimentData(): MarketSentiment {
    return {
      fearGreedIndex: 65,
      sentiment: 'Greed',
      timestamp: new Date().toISOString()
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    
    const marketService = MarketDataService.getInstance();
    
    let data: any = {};
    
    switch (type) {
      case 'stocks':
        data.stocks = await marketService.fetchStockData();
        break;
      case 'crypto':
        const limit = parseInt(searchParams.get('limit') || '10');
        data.crypto = await marketService.fetchCryptoData(limit);
        break;
      case 'forex':
        data.forex = await marketService.fetchForexData();
        break;
      case 'sentiment':
        data.sentiment = await marketService.fetchMarketSentiment();
        break;
      case 'all':
      default:
        // Use Promise.allSettled to handle partial failures gracefully
        const results = await Promise.allSettled([
          marketService.fetchStockData(),
          marketService.fetchCryptoData(10),
          marketService.fetchForexData(),
          marketService.fetchMarketSentiment()
        ]);
        
        data = {
          stocks: results[0].status === 'fulfilled' ? results[0].value : [],
          crypto: results[1].status === 'fulfilled' ? results[1].value : [],
          forex: results[2].status === 'fulfilled' ? results[2].value : [],
          sentiment: results[3].status === 'fulfilled' ? results[3].value : null
        };
        break;
    }
    
    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      cached: false // You could implement cache status tracking
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error) {
    console.error('Error in market data API:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}