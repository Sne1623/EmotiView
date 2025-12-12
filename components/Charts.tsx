
import React from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ScatterChart, Scatter, ZAxis 
} from 'recharts';
import { AnalysisResult, SentimentType } from '../types';
import { BarChart2 } from './Icons';

interface Props {
  results: AnalysisResult[];
}

const COLORS = {
  [SentimentType.POSITIVE]: '#16a34a', // Green 600
  [SentimentType.NEUTRAL]: '#525252',  // Neutral 600
  [SentimentType.NEGATIVE]: '#dc2626', // Red 600
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg max-w-[200px]">
        <p className="font-bold text-black mb-1">{label || payload[0].name}</p>
        {payload.map((p: any, idx: number) => (
          <p key={idx} className="text-sm font-medium" style={{ color: p.color }}>
            {p.name === 'value' ? 'Count' : p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const ScatterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg max-w-[250px] z-50">
        <div className="flex items-center gap-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${data.sentiment === 'Positive' ? 'bg-green-600' : data.sentiment === 'Negative' ? 'bg-red-600' : 'bg-gray-600'}`}></span>
            <span className="font-black uppercase text-xs">{data.sentiment}</span>
        </div>
        <p className="font-bold text-black text-sm mb-2 line-clamp-2">"{data.text}"</p>
        <p className="text-xs font-mono bg-sky-100 p-1 rounded">Confidence: {(data.confidence * 100).toFixed(0)}%</p>
        <p className="text-xs mt-1 text-gray-500">{data.emotion}</p>
      </div>
    );
  }
  return null;
};

export const SentimentDistributionChart: React.FC<Props> = ({ results }) => {
  const counts = results.reduce(
    (acc, curr) => {
      acc[curr.sentiment]++;
      return acc;
    },
    { [SentimentType.POSITIVE]: 0, [SentimentType.NEUTRAL]: 0, [SentimentType.NEGATIVE]: 0 }
  );

  const data = [
    { name: 'Positive', value: counts[SentimentType.POSITIVE], color: COLORS[SentimentType.POSITIVE] },
    { name: 'Neutral', value: counts[SentimentType.NEUTRAL], color: COLORS[SentimentType.NEUTRAL] },
    { name: 'Negative', value: counts[SentimentType.NEGATIVE], color: COLORS[SentimentType.NEGATIVE] },
  ].filter(d => d.value > 0);

  if (results.length === 0) return <EmptyChartPlaceholder />;

  return (
    <div className="h-64 w-full font-sans">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            stroke="black"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const EmotionBarChart: React.FC<Props> = ({ results }) => {
  const emotionCounts: Record<string, number> = {};
  
  results.forEach(r => {
    const emotion = r.emotion || 'Unknown';
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
  });

  const data = Object.entries(emotionCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  if (results.length === 0) return <EmptyChartPlaceholder />;

  return (
    <div className="h-64 w-full font-sans">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={100} 
            tick={{ fill: 'black', fontWeight: 'bold', fontSize: 12 }} 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} stroke="black" strokeWidth={2} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ComparativeSentimentChart: React.FC<Props> = ({ results }) => {
  // Map results to scatter data
  // X: Index 
  // Y: Confidence
  // Z: Size (constant)
  
  if (results.length === 0) return <EmptyChartPlaceholder />;

  const data = results.map((r, index) => ({
    index: index + 1,
    confidence: r.confidence,
    sentiment: r.sentiment,
    text: r.text,
    emotion: r.emotion,
    fill: COLORS[r.sentiment] || '#000'
  }));

  return (
    <div className="h-64 w-full font-sans">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="index" name="Text ID" unit="" tick={{ fontSize: 12 }} />
          <YAxis type="number" dataKey="confidence" name="Confidence" unit="" domain={[0.5, 1]} tick={{ fontSize: 12 }} />
          <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Legend verticalAlign="bottom" height={36} />
          <Scatter name="Analysis Items" data={data} fill="#8884d8">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} stroke="black" strokeWidth={1} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

const EmptyChartPlaceholder = () => (
  <div className="h-64 flex flex-col items-center justify-center text-gray-400 font-bold bg-white rounded-xl border-2 border-dashed border-gray-300">
    <BarChart2 size={32} className="mb-2 opacity-50" />
    <span>No Data Available</span>
  </div>
);
