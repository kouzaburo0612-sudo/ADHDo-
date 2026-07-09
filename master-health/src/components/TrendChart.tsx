/** トレンドグラフ(victory-native / Skia描画) */
import { matchFont } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Area, CartesianChart, Line } from 'victory-native';

import { Colors } from '@/constants/theme';
import { formatValue, type MetricKey } from '@/lib/metrics';
import type { SeriesPoint } from '@/hooks/useHealthData';

const axisFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
  fontSize: 10,
});

export function TrendChart({ points, metric, height = 220 }: {
  points: SeriesPoint[];
  metric: MetricKey;
  height?: number;
}) {
  const data = useMemo(
    () => points.map((p, i) => ({ i, value: p.value })),
    [points],
  );
  const labels = useMemo(() => points.map((p) => p.label), [points]);

  if (points.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>この期間のデータがまだありません</Text>
      </View>
    );
  }

  return (
    <View style={{ height }}>
      <CartesianChart
        data={data}
        xKey="i"
        yKeys={['value']}
        domainPadding={{ left: 14, right: 14, top: 24, bottom: 4 }}
        axisOptions={{
          font: axisFont,
          labelColor: Colors.textFaint,
          lineColor: Colors.chartGrid,
          tickCount: { x: Math.min(6, points.length), y: 4 },
          formatXLabel: (i) => labels[Math.round(Number(i))] ?? '',
          formatYLabel: (v) => formatValue(metric, Number(v)),
        }}
      >
        {({ points: pts, chartBounds }) => (
          <>
            <Area
              points={pts.value}
              y0={chartBounds.bottom}
              color={`${Colors.accent}22`}
              curveType="monotoneX"
              animate={{ type: 'timing', duration: 350 }}
            />
            <Line
              points={pts.value}
              color={Colors.accent}
              strokeWidth={2.5}
              curveType="monotoneX"
              animate={{ type: 'timing', duration: 350 }}
            />
          </>
        )}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textFaint, fontSize: 13 },
});
