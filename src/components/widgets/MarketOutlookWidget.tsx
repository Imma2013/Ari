'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, RefreshCw, BarChart3, Coins, Globe } from 'lucide-react';

// Updated type definitions to match the new API
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

// Display format for UI
interface DisplayMarketData {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  trend: 'up' | 'down' | 'neutral';
  marketCap?: string;
  volume?: string;
}

const MarketOutlookWidget: React.FC = () => {
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [forexData, setForexData] = useState<ForexData[]>([]);
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'stocks' | 'crypto' | 'forex'>('stocks');
  const [error, setError] = useState<string | null>(null);

  const fetchAllMarketData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all market data from our updated API route
      const response = await fetch('/api/market-data?type=all');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setStockData(result.data.stocks || []);
        setCryptoData(result.data.crypto || []);
        setForexData(result.data.forex || []);
        setSentiment(result.data.sentiment || null);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.message || result.error || 'Failed to fetch market data');
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMarketData();
    
    // Refresh data every 5 minutes
    const interval = setInterval(fetchAllMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Format stock data for display
  const formatStockData = (stock: StockData): DisplayMarketData => ({
    symbol: stock.symbol,
    name: stock.name,
    price: `$${stock.price.toFixed(2)}`,
    change: stock.change > 0 ? `+$${stock.change.toFixed(2)}` : `$${stock.change.toFixed(2)}`,
    changePercent: `${stock.changePercent > 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`,
    trend: stock.changePercent > 0 ? 'up' : stock.changePercent < 0 ? 'down' : 'neutral',
    marketCap: stock.marketCap ? `$${(stock.marketCap / 1000000000).toFixed(1)}B` : undefined,
    volume: stock.volume ? stock.volume.toLocaleString() : undefined
  });

  // Format crypto data for display
  const formatCryptoData = (crypto: CryptoData): DisplayMarketData => ({
    symbol: crypto.symbol.toUpperCase(),
    name: crypto.name,
    price: `$${crypto.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
    change: `$${crypto.price_change_24h.toFixed(2)}`,
    changePercent: `${crypto.price_change_percentage_24h > 0 ? '+' : ''}${crypto.price_change_percentage_24h.toFixed(2)}%`,
    trend: crypto.price_change_percentage_24h > 0 ? 'up' : crypto.price_change_percentage_24h < 0 ? 'down' : 'neutral',
    marketCap: `$${(crypto.market_cap / 1000000000).toFixed(1)}B`,
    volume: `$${(crypto.total_volume / 1000000).toFixed(1)}M`
  });

  // Format forex data for display
  const formatForexData = (forex: ForexData): DisplayMarketData => ({
    symbol: forex.pair,
    name: forex.pair.replace('/', ' / '),
    price: forex.rate.toFixed(4),
    change: forex.change > 0 ? `+${forex.change.toFixed(4)}` : `${forex.change.toFixed(4)}`,
    changePercent: `${forex.changePercent > 0 ? '+' : ''}${forex.changePercent.toFixed(2)}%`,
    trend: forex.changePercent > 0 ? 'up' : forex.changePercent < 0 ? 'down' : 'neutral'
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getSentimentColor = (index: number) => {
    if (index >= 0 && index <= 25) return 'text-red-500';
    if (index > 25 && index <= 45) return 'text-orange-500';
    if (index > 45 && index <= 55) return 'text-yellow-500';
    if (index > 55 && index <= 75) return 'text-green-500';
    return 'text-green-600';
  };

  const getSentimentLabel = (index: number) => {
    if (index >= 0 && index <= 25) return 'Extreme Fear';
    if (index > 25 && index <= 45) return 'Fear';
    if (index > 45 && index <= 55) return 'Neutral';
    if (index > 55 && index <= 75) return 'Greed';
    return 'Extreme Greed';
  };

  const renderMarketItem = (item: DisplayMarketData, showVolume: boolean = false) => (
    <div key={item.symbol} className="flex items-center justify-between p-2 bg-light-100 dark:bg-dark-100 rounded">
      <div className="flex-1">
        <div className="text-sm font-medium text-black dark:text-white">{item.name}</div>
        <div className="text-xs text-black/60 dark:text-white/60">{item.symbol}</div>
        {showVolume && item.volume && (
          <div className="text-xs text-black/50 dark:text-white/50">
            Vol: {item.volume}
          </div>
        )}
        {item.marketCap && (
          <div className="text-xs text-black/50 dark:text-white/50">
            Cap: {item.marketCap}
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-black dark:text-white">{item.price}</div>
        <div className={`text-xs flex items-center justify-end ${item.trend === 'up' ? 'text-green-500' : item.trend === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
          {item.trend === 'up' && <TrendingUp className="w-3 h-3 mr-1" />}
          {item.trend === 'down' && <TrendingDown className="w-3 h-3 mr-1" />}
          <span>{item.changePercent}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-light-secondary dark:bg-dark-secondary rounded-lg p-4 border border-light-200 dark:border-dark-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-[#24A0ED]" />
          <h3 className="font-semibold text-black dark:text-white">Market Outlook</h3>
        </div>
        <button
          onClick={fetchAllMarketData}
          disabled={loading}
          className="p-1 hover:bg-light-200 dark:hover:bg-dark-200 rounded transition-colors disabled:opacity-50"
          title="Refresh market data"
        >
          <RefreshCw className={`w-4 h-4 text-black/60 dark:text-white/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            Error loading market data: {error}
          </p>
          <button 
            onClick={fetchAllMarketData}
            className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-light-200 dark:bg-dark-200 rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-light-200 dark:bg-dark-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-4 bg-light-100 dark:bg-dark-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('stocks')}
              className={`flex items-center space-x-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'stocks' 
                  ? 'bg-white dark:bg-dark-200 text-black dark:text-white shadow-sm' 
                  : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              <span>Stocks ({stockData.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('crypto')}
              className={`flex items-center space-x-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'crypto' 
                  ? 'bg-white dark:bg-dark-200 text-black dark:text-white shadow-sm' 
                  : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
              }`}
            >
              <Coins className="w-3 h-3" />
              <span>Crypto ({cryptoData.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('forex')}
              className={`flex items-center space-x-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'forex' 
                  ? 'bg-white dark:bg-dark-200 text-black dark:text-white shadow-sm' 
                  : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Forex ({forexData.length})</span>
            </button>
          </div>

          {/* Market Data Content */}
          <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
            {activeTab === 'stocks' && stockData.length > 0 && 
              stockData.map(stock => renderMarketItem(formatStockData(stock), true))
            }
            {activeTab === 'crypto' && cryptoData.length > 0 && 
              cryptoData.map(crypto => renderMarketItem(formatCryptoData(crypto), true))
            }
            {activeTab === 'forex' && forexData.length > 0 && 
              forexData.map(forex => renderMarketItem(formatForexData(forex)))
            }
            
            {/* Empty state */}
            {((activeTab === 'stocks' && stockData.length === 0) ||
              (activeTab === 'crypto' && cryptoData.length === 0) ||
              (activeTab === 'forex' && forexData.length === 0)) && !loading && (
              <div className="text-center py-8 text-black/50 dark:text-white/50">
                <div className="text-sm">No {activeTab} data available</div>
                <button 
                  onClick={fetchAllMarketData}
                  className="text-xs text-[#24A0ED] hover:underline mt-1"
                >
                  Refresh to try again
                </button>
              </div>
            )}
          </div>

          {/* Market Sentiment - Updated to use Fear & Greed Index */}
          {sentiment && (
            <div className="mb-3">
              <h4 className="text-sm font-medium text-black/70 dark:text-white/70 mb-2">Market Sentiment</h4>
              <div className="p-3 bg-light-100 dark:bg-dark-100 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-black dark:text-white mb-1">
                    {sentiment.fearGreedIndex}
                  </div>
                  <div className={`text-sm font-medium mb-1 ${getSentimentColor(sentiment.fearGreedIndex)}`}>
                    {getSentimentLabel(sentiment.fearGreedIndex)}
                  </div>
                  <div className="text-xs text-black/60 dark:text-white/60">
                    Fear & Greed Index
                  </div>
                  
                  {/* Visual indicator */}
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        sentiment.fearGreedIndex <= 25 ? 'bg-red-500' :
                        sentiment.fearGreedIndex <= 45 ? 'bg-orange-500' :
                        sentiment.fearGreedIndex <= 55 ? 'bg-yellow-500' :
                        sentiment.fearGreedIndex <= 75 ? 'bg-green-500' : 'bg-green-600'
                      }`}
                      style={{ width: `${sentiment.fearGreedIndex}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-black/50 dark:text-white/50 text-center pt-2 border-t border-light-200 dark:border-dark-200">
            Last updated: {formatTime(lastUpdated)}
          </div>
        </>
      )}
    </div>
  );
};

export default MarketOutlookWidget;