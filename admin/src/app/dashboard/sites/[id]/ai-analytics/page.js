'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function AIAnalyticsPage() {
  const params = useParams();
  const siteId = params.id;
  
  const [intentAnalytics, setIntentAnalytics] = useState([]);
  const [classificationAnalytics, setClassificationAnalytics] = useState([]);
  const [recentIntents, setRecentIntents] = useState([]);
  const [recentClassifications, setRecentClassifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      };

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const baseUrl = API_URL.replace(/\/$/, '');

      const [intentRes, classRes, recentIntentRes, recentClassRes] = await Promise.all([
        fetch(`${baseUrl}/api/admin/ai-chat/${siteId}/analytics/intents?days=${days}`, { headers }),
        fetch(`${baseUrl}/api/admin/ai-chat/${siteId}/analytics/classifications?days=${days}`, { headers }),
        fetch(`${baseUrl}/api/admin/ai-chat/${siteId}/intents?limit=20`, { headers }),
        fetch(`${baseUrl}/api/admin/ai-chat/${siteId}/classifications?limit=20`, { headers }),
      ]);

      if (!intentRes.ok || !classRes.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const [intentData, classData, recentIntentData, recentClassData] = await Promise.all([
        intentRes.json(),
        classRes.json(),
        recentIntentRes.json(),
        recentClassRes.json(),
      ]);

      setIntentAnalytics(intentData.analytics || []);
      setClassificationAnalytics(classData.analytics || []);
      setRecentIntents(recentIntentData.intents || []);
      setRecentClassifications(recentClassData.classifications || []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [siteId, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatIntent = (intent) => {
    return intent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getIntentColor = (intent) => {
    const colors = {
      service_request: 'bg-blue-100 text-blue-800',
      estimate_request: 'bg-green-100 text-green-800',
      inspection_booking: 'bg-purple-100 text-purple-800',
      information_question: 'bg-yellow-100 text-yellow-800',
      complaint: 'bg-red-100 text-red-800',
      greeting: 'bg-gray-100 text-gray-800',
      unknown: 'bg-orange-100 text-orange-800',
    };
    return colors[intent] || 'bg-gray-100 text-gray-800';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
          <button 
            onClick={fetchData}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">AI Analytics</h1>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="border rounded-lg px-3 py-2"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Intent Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Intent Distribution</h2>
          {intentAnalytics.length === 0 ? (
            <p className="text-gray-500">No intent data available</p>
          ) : (
            <div className="space-y-3">
              {intentAnalytics.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getIntentColor(item.intent)}`}>
                      {formatIntent(item.intent)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{item.count} requests</span>
                    <span className={`text-sm font-medium ${getConfidenceColor(parseFloat(item.avg_confidence))}`}>
                      {(parseFloat(item.avg_confidence) * 100).toFixed(0)}% avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Classification Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Problem Classification</h2>
          {classificationAnalytics.length === 0 ? (
            <p className="text-gray-500">No classification data available</p>
          ) : (
            <div className="space-y-3">
              {classificationAnalytics.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{formatIntent(item.job_type || 'Unknown')}</span>
                    {item.industry_slug && (
                      <span className="text-xs text-gray-500 ml-2">({item.industry_slug})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{item.count}</span>
                    <span className={`text-sm font-medium ${getConfidenceColor(parseFloat(item.avg_confidence))}`}>
                      {(parseFloat(item.avg_confidence) * 100).toFixed(0)}%
                    </span>
                    {parseInt(item.needs_more_info_count) > 0 && (
                      <span className="text-xs text-orange-600">
                        {item.needs_more_info_count} need info
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Intents */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Intent Detections</h2>
        {recentIntents.length === 0 ? (
          <p className="text-gray-500">No recent intents</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Intent</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Input</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentIntents.slice(0, 10).map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getIntentColor(item.intent)}`}>
                        {formatIntent(item.intent)}
                      </span>
                    </td>
                    <td className={`px-4 py-2 text-sm font-medium ${getConfidenceColor(item.confidence)}`}>
                      {(item.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">
                      {item.input_text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Classifications */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Problem Classifications</h2>
        {recentClassifications.length === 0 ? (
          <p className="text-gray-500">No recent classifications</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Job Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Industry</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentClassifications.slice(0, 10).map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium">
                      {formatIntent(item.job_type || 'Unknown')}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {item.industry_name || item.industry_slug || '-'}
                    </td>
                    <td className={`px-4 py-2 text-sm font-medium ${getConfidenceColor(item.confidence)}`}>
                      {(item.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-2">
                      {item.needs_more_info ? (
                        <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">
                          Needs Info
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          Complete
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
