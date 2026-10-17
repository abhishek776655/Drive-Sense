import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {
  TrendChart,
  clampTooltipLeft,
  formatBucketValue,
  pickAxisLabelIndexes,
  scaleBarHeight,
  type TrendChartBucket,
} from '../TrendChart';

const bucket = (overrides: Partial<TrendChartBucket> & {key: string}): TrendChartBucket => ({
  label: 'Fri',
  detailLabel: 'Fri, 14 Aug',
  value: 12,
  tripCount: 2,
  score: 88,
  ...overrides,
});

describe('scaleBarHeight', () => {
  it('gives the tallest bucket the full plot height', () => {
    expect(scaleBarHeight(20, 20, 100)).toBe(100);
  });

  it('scales proportionally', () => {
    expect(scaleBarHeight(5, 20, 100)).toBe(25);
  });

  it('leaves a visible stub for an empty bucket so it does not read as a gap', () => {
    expect(scaleBarHeight(0, 20, 100)).toBe(3);
  });

  it('does not divide by zero when every bucket is empty', () => {
    expect(scaleBarHeight(0, 0, 100)).toBe(3);
  });
});

describe('clampTooltipLeft', () => {
  it('centres the tooltip on the column when there is room', () => {
    expect(clampTooltipLeft(150, 300, 100)).toBe(100);
  });

  it('keeps the tooltip inside the left edge', () => {
    expect(clampTooltipLeft(10, 300, 100)).toBe(0);
  });

  it('keeps the tooltip inside the right edge', () => {
    expect(clampTooltipLeft(295, 300, 100)).toBe(200);
  });

  it('does not go negative when the chart is narrower than the tooltip', () => {
    expect(clampTooltipLeft(20, 60, 100)).toBe(0);
  });
});

describe('formatBucketValue', () => {
  it('drops a pointless decimal', () => {
    expect(formatBucketValue(12, 'km')).toBe('12 km');
  });

  it('keeps one decimal for a short trip', () => {
    expect(formatBucketValue(0.4, 'km')).toBe('0.4 km');
  });
});

describe('pickAxisLabelIndexes', () => {
  it('keeps every label when the range is short', () => {
    expect(pickAxisLabelIndexes(6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('thins a long range down and keeps the first and last', () => {
    const indexes = pickAxisLabelIndexes(14);

    expect(indexes.length).toBeLessThanOrEqual(7);
    expect(indexes[0]).toBe(0);
    expect(indexes[indexes.length - 1]).toBe(13);
  });

  it('never repeats an index', () => {
    expect(new Set(pickAxisLabelIndexes(9)).size).toBe(pickAxisLabelIndexes(9).length);
  });

  it('returns nothing for an empty range', () => {
    expect(pickAxisLabelIndexes(0)).toEqual([]);
  });
});

describe('TrendChart interaction', () => {
  const buckets = [
    bucket({key: 'a', label: 'Thu', detailLabel: 'Thu, 13 Aug', value: 8, tripCount: 1}),
    bucket({key: 'b', label: 'Fri', detailLabel: 'Fri, 14 Aug', value: 12.5, tripCount: 3, score: 91}),
  ];

  it('shows no tooltip until a bar is tapped', () => {
    render(<TrendChart buckets={buckets} previousValues={[4, 6]} />);

    expect(screen.queryByText('Fri, 14 Aug')).toBeNull();
  });

  it('reveals the bucket detail on tap', () => {
    render(<TrendChart buckets={buckets} previousValues={[4, 6]} />);

    fireEvent.press(screen.getByLabelText('Fri, 14 Aug: 12.5 km, 3 trips'));

    expect(screen.getByText('Fri, 14 Aug')).toBeTruthy();
    expect(screen.getByText('12.5 km')).toBeTruthy();
    expect(screen.getByText('3 trips · score 91')).toBeTruthy();
  });

  it('singularises a one-trip bucket', () => {
    render(<TrendChart buckets={buckets} previousValues={[4, 6]} />);

    fireEvent.press(screen.getByLabelText('Thu, 13 Aug: 8 km, 1 trips'));

    expect(screen.getByText('1 trip · score 88')).toBeTruthy();
  });

  it('omits the score when the bucket has none', () => {
    render(
      <TrendChart
        buckets={[bucket({key: 'c', detailLabel: 'Sat, 15 Aug', value: 0, tripCount: 0, score: null})]}
        previousValues={[0]}
      />,
    );

    fireEvent.press(screen.getByLabelText('Sat, 15 Aug: 0 km, 0 trips'));

    expect(screen.getByText('0 trips')).toBeTruthy();
  });

  it('dismisses the tooltip when the selected bar is tapped again', () => {
    render(<TrendChart buckets={buckets} previousValues={[4, 6]} />);
    const bar = screen.getByLabelText('Fri, 14 Aug: 12.5 km, 3 trips');

    fireEvent.press(bar);
    fireEvent.press(bar);

    expect(screen.queryByText('12.5 km')).toBeNull();
  });

  it('renders the status message instead of the metric footer', () => {
    render(
      <TrendChart
        buckets={buckets}
        previousValues={[4, 6]}
        metricValue="138 km"
        statusMessage="Loading range…"
      />,
    );

    expect(screen.getByText('Loading range…')).toBeTruthy();
    expect(screen.queryByText('138 km')).toBeNull();
  });
});
