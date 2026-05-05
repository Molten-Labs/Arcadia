import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Defs, LinearGradient as SvgGradient, Stop, Polygon } from 'react-native-svg';
import { colors } from '../lib/theme';

interface Props {
  data: number[];
  width: number;
  height: number;
  positive?: boolean;
}

export function NavSparkline({ data, width, height, positive = true }: Props) {
  if (!data || data.length < 2) return <View style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.001;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return { x, y };
  });

  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Build fill polygon: line + baseline
  const fill = [
    ...pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${width},${height}`,
    `0,${height}`,
  ].join(' ');

  const color = positive ? colors.signal : colors.danger;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Polygon points={fill} fill="url(#sg)" />
      <Polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
