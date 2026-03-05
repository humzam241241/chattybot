import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const API_URL = process.env.REACT_APP_API_URL;
const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;

function StatsPage({ siteFilter }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, [siteFilter]);

  async function loadStats() {
    setLoading(true);
    setError(null);

    try {
      const url = siteFilter
        ? `${API_URL}/api/admin/stats?site_id=${siteFilter}`
        : `${API_URL}/api/admin/stats`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
      });

      if (!res.ok) throw new Error('Failed to fetch stats');

      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  const dailyVolumeData = {
    labels: stats.daily_volume.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Conversations',
        data: stats.daily_volume.map(d => d.count),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.3,
      },
    ],
  };

  const conversionRate = stats.total_conversations > 0
    ? ((stats.total_leads / stats.total_conversations) * 100).toFixed(1)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
        <p className="text-sm text-gray-600 mt-1">Performance metrics and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Conversations"
          value={stats.total_conversations}
          color="blue"
        />
        <StatCard
          label="Total Leads"
          value={stats.total_leads}
          color="green"
        />
        <StatCard
          label="Avg Messages/Chat"
          value={stats.avg_messages_per_chat}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Conversation Volume (Last 7 Days)
          </h3>
          <Line
            data={dailyVolumeData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
              },
              scales: {
                y: { beginAtZero: true },
              },
            }}
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Lead Conversion Rate
          </h3>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-6xl font-bold text-primary">{conversionRate}%</div>
              <p className="text-sm text-gray-600 mt-2">
                {stats.total_leads} leads from {stats.total_conversations} conversations
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricRow label="Database Connection" value="✓ Connected" />
          <MetricRow label="Last Updated" value={new Date().toLocaleString()} />
          <MetricRow label="Total Conversations" value={stats.total_conversations} />
          <MetricRow label="Total Leads" value={stats.total_leads} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className={`p-6 rounded-lg border ${colors[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default StatsPage;
