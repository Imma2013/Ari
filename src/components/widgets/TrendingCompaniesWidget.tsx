'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Building2, RefreshCw, AlertCircle } from 'lucide-react';

// API response interfaces matching the new route
interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  volume?: number;
}

// Display interface for the widget
interface TrendingCompany {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  trend: 'up' | 'down' | 'neutral';
  volume?: string;
  marketCap?: string;
}

const TrendingCompaniesWidget: React.FC = () => {
  const [companies, setCompanies] = useState<TrendingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Popular tech and trending companies to focus on
  const targetCompanies = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 
    'AMD', 'CRM', 'ADBE', 'PLTR', 'INTC', 'ORCL'
  ];

  const formatStockToCompany = (stock: StockData): TrendingCompany => {
    return {
      symbol: stock.symbol,
      name: stock.name || getCompanyName(stock.symbol),
      price: `$${stock.price.toFixed(2)}`,
      change: stock.change >= 0 ? `+$${stock.change.toFixed(2)}` : `$${stock.change.toFixed(2)}`,
      changePercent: `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`,
      trend: stock.changePercent > 0 ? 'up' : stock.changePercent < 0 ? 'down' : 'neutral',
      volume: stock.volume ? formatVolume(stock.volume) : undefined,
      marketCap: stock.marketCap ? formatMarketCap(stock.marketCap) : undefined
    };
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  };

  const formatMarketCap = (marketCap: number): string => {
    if (marketCap >= 1000000000000) {
      return `$${(marketCap / 1000000000000).toFixed(1)}T`;
    } else if (marketCap >= 1000000000) {
      return `$${(marketCap / 1000000000).toFixed(1)}B`;
    } else if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(1)}M`;
    }
    return `$${marketCap.toLocaleString()}`;
  };

  const getCompanyName = (symbol: string): string => {
    const companyNames: { [key: string]: string } = {
      'AAPL': 'Apple Inc.',
      'MSFT': 'Microsoft Corporation',
      'GOOGL': 'Alphabet Inc.',
      'AMZN': 'Amazon.com Inc.',
      'TSLA': 'Tesla Inc.',
      'NVDA': 'NVIDIA Corporation',
      'META': 'Meta Platforms Inc.',
      'NFLX': 'Netflix Inc.',
      'PLTR': 'Palantir Technologies Inc.',
      'AMD': 'Advanced Micro Devices Inc.',
      'CRM': 'Salesforce Inc.',
      'ADBE': 'Adobe Inc.',
      'INTC': 'Intel Corporation',
      'ORCL': 'Oracle Corporation',
      'IBM': 'IBM Corporation',
      'SPOT': 'Spotify Technology S.A.',
      'UBER': 'Uber Technologies Inc.',
      'SHOP': 'Shopify Inc.'
    };
    return companyNames[symbol] || symbol;
  };

  const fetchTrendingCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch stock data from our updated API route
      const response = await fetch('/api/market-data?type=stocks');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data.stocks && Array.isArray(result.data.stocks)) {
        // Filter and prioritize target companies
        const allStocks = result.data.stocks as StockData[];
        
        // First, get target companies that are available
        const targetStocks = allStocks.filter(stock => 
          targetCompanies.includes(stock.symbol.toUpperCase())
        );
        
        // If we don't have enough target companies, fill with other stocks
        let finalStocks = targetStocks;
        if (finalStocks.length < 8) {
          const otherStocks = allStocks.filter(stock => 
            !targetCompanies.includes(stock.symbol.toUpperCase())
          );
          finalStocks = [...targetStocks, ...otherStocks].slice(0, 8);
        }
        
        // Sort by absolute change percentage (most volatile first)
        finalStocks.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
        
        // Take top 6 for display
        const trendingCompanies = finalStocks.slice(0, 6).map(formatStockToCompany);
        
        if (trendingCompanies.length > 0) {
          setCompanies(trendingCompanies);
        } else {
          setCompanies(getFallbackCompanies());
        }
      } else {
        throw new Error(result.message || 'No stock data received');
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching trending companies:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
      setCompanies(getFallbackCompanies());
    } finally {
      setLoading(false);
    }
  }, []);

  const getFallbackCompanies = (): TrendingCompany[] => {
    return [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: '$185.92',
        change: '+$2.45',
        changePercent: '+1.33%',
        trend: 'up',
        volume: '45.2M',
        marketCap: '$2.9T'
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        price: '$378.85',
        change: '+$1.23',
        changePercent: '+0.33%',
        trend: 'up',
        volume: '22.1M',
        marketCap: '$2.8T'
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        price: '$142.56',
        change: '-$0.67',
        changePercent: '-0.47%',
        trend: 'down',
        volume: '18.9M',
        marketCap: '$1.8T'
      },
      {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        price: '$248.42',
        change: '+$5.23',
        changePercent: '+2.15%',
        trend: 'up',
        volume: '89.7M',
        marketCap: '$790.5B'
      },
      {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        price: '$875.30',
        change: '+$12.45',
        changePercent: '+1.44%',
        trend: 'up',
        volume: '35.8M',
        marketCap: '$2.2T'
      },
      {
        symbol: 'META',
        name: 'Meta Platforms Inc.',
        price: '$324.50',
        change: '-$2.15',
        changePercent: '-0.66%',
        trend: 'down',
        volume: '28.4M',
        marketCap: '$825.3B'
      }
    ];
  };

  useEffect(() => {
    fetchTrendingCompanies();
    
    // Refresh data every 5 minutes (aligned with API cache)
    const interval = setInterval(fetchTrendingCompanies, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrendingCompanies]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="bg-light-secondary dark:bg-dark-secondary rounded-lg p-4 border border-light-200 dark:border-dark-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-[#24A0ED]" />
          <h3 className="font-semibold text-black dark:text-white">Trending Companies</h3>
        </div>
        <button
          onClick={fetchTrendingCompanies}
          disabled={loading}
          className="p-1 hover:bg-light-200 dark:hover:bg-dark-200 rounded transition-colors disabled:opacity-50"
          title="Refresh trending companies"
        >
          <RefreshCw className={`w-4 h-4 text-black/60 dark:text-white/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                Using cached data: {error}
              </p>
              <button 
                onClick={fetchTrendingCompanies}
                className="mt-1 text-xs text-orange-600 dark:text-orange-400 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between p-2 bg-light-100 dark:bg-dark-100 rounded">
                <div className="flex-1">
                  <div className="h-4 bg-light-200 dark:bg-dark-200 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-light-200 dark:bg-dark-200 rounded w-1/2"></div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-light-200 dark:bg-dark-200 rounded w-16 mb-1"></div>
                  <div className="h-3 bg-light-200 dark:bg-dark-200 rounded w-12"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {companies.map((company, index) => (
              <div key={`${company.symbol}-${index}`} className="flex items-center justify-between p-2 bg-light-100 dark:bg-dark-100 rounded hover:bg-light-200 dark:hover:bg-dark-200/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-black dark:text-white truncate">
                    {company.name}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-black/60 dark:text-white/60">
                    <span>{company.symbol}</span>
                    {company.marketCap && (
                      <span className="text-black/50 dark:text-white/50">• {company.marketCap}</span>
                    )}
                  </div>
                  {company.volume && (
                    <div className="text-xs text-black/40 dark:text-white/40">
                      Vol: {company.volume}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-black dark:text-white">
                    {company.price}
                  </div>
                  <div className={`text-xs flex items-center justify-end ${
                    company.trend === 'up' ? 'text-green-500' : 
                    company.trend === 'down' ? 'text-red-500' : 
                    'text-gray-500'
                  }`}>
                    {company.trend === 'up' && <TrendingUp className="w-3 h-3 mr-1" />}
                    {company.trend === 'down' && <TrendingDown className="w-3 h-3 mr-1" />}
                    <span>{company.changePercent}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {companies.length === 0 && !loading && (
            <div className="text-center py-8 text-black/50 dark:text-white/50">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm">No company data available</div>
              <button 
                onClick={fetchTrendingCompanies}
                className="text-xs text-[#24A0ED] hover:underline mt-1"
              >
                Refresh to try again
              </button>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-black/50 dark:text-white/50 text-center pt-3 border-t border-light-200 dark:border-dark-200 mt-3">
            Last updated: {formatTime(lastUpdated)}
            {companies.length > 0 && (
              <span className="ml-2">• {companies.length} companies</span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TrendingCompaniesWidget;