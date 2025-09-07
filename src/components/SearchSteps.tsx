'use client';

import React, { useState, useEffect } from 'react';
import { PipelineStage } from '@/lib/search/orchestrator';
import { 
  Search, 
  Brain, 
  Rocket, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Layers,
  Sparkles,
  Target,
  Globe,
  BookOpen,
  FileText,
  Cpu,
  Network,
  Shield,
  BarChart3,
  Lightbulb,
  Zap,
  ExternalLink
} from 'lucide-react';

interface SearchStepsProps {
  pipelineStages: PipelineStage[];
  isVisible: boolean;
  mode?: 'quick' | 'pro' | 'ultra';
  progress?: {
    step: string;
    message: string;
    details: string;
    progress: number;
  };
}

const getModeConfig = (mode: 'quick' | 'pro' | 'ultra' = 'quick') => {
  switch (mode) {
    case 'quick':
      return {
        color: 'blue',
        gradient: 'from-blue-500 to-blue-600',
        bgGradient: 'from-blue-50 to-blue-100',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-700',
        icon: Search,
        name: 'Quick Search',
        description: 'Fast and efficient search'
      };
    case 'pro':
      return {
        color: 'purple',
        gradient: 'from-purple-500 to-purple-600',
        bgGradient: 'from-purple-50 to-purple-100',
        borderColor: 'border-purple-200',
        textColor: 'text-purple-700',
        icon: Brain,
        name: 'Pro Search',
        description: 'Comprehensive research analysis'
      };
    case 'ultra':
      return {
        color: 'emerald',
        gradient: 'from-emerald-500 to-emerald-600',
        bgGradient: 'from-emerald-50 to-emerald-100',
        borderColor: 'border-emerald-200',
        textColor: 'text-emerald-700',
        icon: Rocket,
        name: 'Ultra Search',
        description: 'PhD-level comprehensive analysis'
      };
  }
};

const getStepIcon = (stepName: string, mode: 'quick' | 'pro' | 'ultra' = 'quick') => {
  const name = stepName.toLowerCase();
  
  if (name.includes('planning') || name.includes('analysis')) {
    return <Brain size={16} />;
  }
  if (name.includes('search') || name.includes('query')) {
    return <Search size={16} />;
  }
  if (name.includes('agent') || name.includes('parallel')) {
    return <Cpu size={16} />;
  }
  if (name.includes('validation') || name.includes('cross')) {
    return <Shield size={16} />;
  }
  if (name.includes('processing') || name.includes('ranking')) {
    return <BarChart3 size={16} />;
  }
  if (name.includes('generation') || name.includes('response')) {
    return <Sparkles size={16} />;
  }
  if (name.includes('source') || name.includes('document')) {
    return <Globe size={16} />;
  }
  if (name.includes('rerank') || name.includes('sort')) {
    return <TrendingUp size={16} />;
  }
  if (name.includes('ultra') || name.includes('comprehensive')) {
    return <Rocket size={16} />;
  }
  if (name.includes('pro') || name.includes('advanced')) {
    return <Brain size={16} />;
  }
  
  return <Lightbulb size={16} />;
};

const getStatusColor = (status: PipelineStage['status'], mode: 'quick' | 'pro' | 'ultra' = 'quick') => {
  const modeConfig = getModeConfig(mode);
  
  switch (status) {
    case 'pending':
      return {
        bg: 'bg-gray-100 dark:bg-gray-700',
        border: 'border-gray-200 dark:border-gray-600',
        text: 'text-gray-600 dark:text-gray-400',
        icon: 'text-gray-400'
      };
    case 'running':
      return {
        bg: `${modeConfig.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20' : modeConfig.color === 'purple' ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`,
        border: `${modeConfig.color === 'blue' ? 'border-blue-300' : modeConfig.color === 'purple' ? 'border-purple-300' : 'border-emerald-300'}`,
        text: `${modeConfig.color === 'blue' ? 'text-blue-700' : modeConfig.color === 'purple' ? 'text-purple-700' : 'text-emerald-700'}`,
        icon: `${modeConfig.color === 'blue' ? 'text-blue-500' : modeConfig.color === 'purple' ? 'text-purple-500' : 'text-emerald-500'}`
      };
    case 'completed':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-300',
        text: 'text-green-700',
        icon: 'text-green-500'
      };
    case 'error':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-300',
        text: 'text-red-700',
        icon: 'text-red-500'
      };
    default:
      return {
        bg: 'bg-gray-100 dark:bg-gray-700',
        border: 'border-gray-200 dark:border-gray-600',
        text: 'text-gray-600 dark:text-gray-400',
        icon: 'text-gray-400'
      };
  }
};

const getStatusIcon = (status: PipelineStage['status']) => {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'running':
      return '🔄';
    case 'completed':
      return '✅';
    case 'error':
      return '❌';
    default:
      return '⏳';
  }
};

const getDuration = (stage: PipelineStage) => {
  if (stage.startTime && stage.endTime) {
    const duration = stage.endTime - stage.startTime;
    return `${Math.round(duration / 1000)}s`;
  }
  if (stage.startTime) {
    const duration = Date.now() - stage.startTime;
    return `${Math.round(duration / 1000)}s`;
  }
  return '';
};

const SearchSteps: React.FC<SearchStepsProps> = ({ 
  pipelineStages, 
  isVisible, 
  mode = 'quick',
  progress 
}) => {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const modeConfig = getModeConfig(mode);
  
  if (!isVisible || !pipelineStages || pipelineStages.length === 0) {
    return null;
  }

  const completedStages = pipelineStages.filter((s: PipelineStage) => s.status === 'completed').length;
  const runningStages = pipelineStages.filter((s: PipelineStage) => s.status === 'running').length;
  const failedStages = pipelineStages.filter((s: PipelineStage) => s.status === 'error').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className={`p-6 bg-gradient-to-r ${modeConfig.bgGradient} border-b ${modeConfig.borderColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-gradient-to-r ${modeConfig.gradient} text-white`}>
              <modeConfig.icon size={20} />
            </div>
            <div>
              <h3 className={`font-semibold ${modeConfig.textColor}`}>{modeConfig.name} Orchestrator</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{modeConfig.description}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {completedStages}/{pipelineStages.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {runningStages > 0 ? `${runningStages} running` : 'All stages completed'}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`bg-gradient-to-r ${modeConfig.gradient} h-2 rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${(completedStages / pipelineStages.length) * 100}%` }}
          />
        </div>
      </div>
      
      {/* Steps List */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {pipelineStages.map((stage: PipelineStage, index: number) => {
          const statusColors = getStatusColor(stage.status, mode);
          const isExpanded = expandedStage === `${stage.stage}-${index}`;
          
          return (
            <div
              key={`${stage.stage}-${index}`}
              className={`rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md ${
                statusColors.bg
              } ${statusColors.border}`}
              onClick={() => setExpandedStage(isExpanded ? null : `${stage.stage}-${index}`)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      stage.status === 'running'
                        ? `${modeConfig.color === 'blue' ? 'bg-blue-100 text-blue-700' : modeConfig.color === 'purple' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`
                        : stage.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : stage.status === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getStatusIcon(stage.status)}
                    </div>
                    <div className="flex items-center space-x-2 flex-1">
                      {getStepIcon(stage.name, mode)}
                      <div className="flex-1">
                        <div className={`font-medium ${statusColors.text}`}>
                          {stage.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Stage {stage.stage} - Progress: {stage.progress}%
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {stage.error && (
                      <AlertCircle size={16} className="text-red-500" />
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {getDuration(stage)}
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      stage.status === 'running' ? 'animate-pulse bg-blue-500' :
                      stage.status === 'completed' ? 'bg-green-500' :
                      stage.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                    }`} />
                  </div>
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-3">
                                        {stage.error && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <AlertCircle size={16} className="text-red-500" />
                          <span className="text-sm font-medium text-red-700 dark:text-red-400">Error</span>
                        </div>
                        <p className="text-sm text-red-600 dark:text-red-300 mt-1">{stage.error}</p>
                      </div>
                    )}
                    
                    {stage.data && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stage Data</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {typeof stage.data === 'string' 
                            ? stage.data.substring(0, 200) + (stage.data.length > 200 ? '...' : '')
                            : JSON.stringify(stage.data).substring(0, 200) + '...'
                          }
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Start Time:</span>
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          {stage.startTime ? new Date(stage.startTime).toLocaleTimeString() : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">End Time:</span>
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          {stage.endTime ? new Date(stage.endTime).toLocaleTimeString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer Status */}
      {runningStages > 0 && (
        <div className={`p-4 bg-gradient-to-r ${modeConfig.bgGradient} border-t ${modeConfig.borderColor}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-5 h-5 text-${modeConfig.color}-500 animate-spin`}>
              <Clock size={20} />
            </div>
            <div className="flex-1">
              <div className={`text-sm font-medium ${modeConfig.textColor}`}>
                {runningStages} stage{runningStages > 1 ? 's' : ''} currently running
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {progress?.message || 'Processing search operations...'}
              </div>
            </div>
            {progress?.progress && progress.progress > 0 && (
              <div className={`text-xs font-medium text-${modeConfig.color}-600 bg-white dark:bg-gray-800 px-2 py-1 rounded-full`}>
                {progress.progress}%
              </div>
            )}
          </div>
          {progress?.progress && progress.progress > 0 && (
            <div className="mt-2 w-full bg-white dark:bg-gray-800 rounded-full h-1.5">
              <div 
                className={`bg-gradient-to-r ${modeConfig.gradient} h-1.5 rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          )}
        </div>
      )}
      
      {failedStages > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center space-x-3">
            <AlertCircle size={20} className="text-red-500" />
            <div>
              <div className="text-sm font-medium text-red-700 dark:text-red-400">
                {failedStages} stage{failedStages > 1 ? 's' : ''} failed
              </div>
              <div className="text-xs text-red-600 dark:text-red-300">
                Some operations encountered errors
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchSteps; 