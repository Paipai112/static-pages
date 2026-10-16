export interface VerticalInterval {
  start: number;
  end: number;
}

export interface SeriesGroup {
  series: string;
  productAsins: string[];
  intervals: VerticalInterval[];
}

export interface SeriesLane {
  index: number;
  series: string[];
  productAsins: string[];
}

interface RankedSeriesGroup extends SeriesGroup {
  conflictCount: number;
  originalIndex: number;
  span: number;
}

interface PackedLane extends SeriesLane {
  intervals: VerticalInterval[];
}

function compareText(first: string, second: string): number {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function intervalsOverlap(
  first: VerticalInterval,
  second: VerticalInterval,
): boolean {
  return first.start < second.end && second.start < first.end;
}

function groupsConflict(first: SeriesGroup, second: SeriesGroup): boolean {
  return first.intervals.some((firstInterval) =>
    second.intervals.some((secondInterval) =>
      intervalsOverlap(firstInterval, secondInterval),
    ),
  );
}

function intervalSpan(intervals: VerticalInterval[]): number {
  if (intervals.length === 0) return 0;

  return (
    Math.max(...intervals.map((interval) => interval.end)) -
    Math.min(...intervals.map((interval) => interval.start))
  );
}

function rankGroups(groups: SeriesGroup[]): RankedSeriesGroup[] {
  return groups
    .map((group, originalIndex) => ({
      series: group.series,
      productAsins: [...group.productAsins].sort(compareText),
      intervals: [...group.intervals].sort(
        (first, second) => first.start - second.start || first.end - second.end,
      ),
      conflictCount: groups.reduce(
        (count, candidate) =>
          candidate !== group && groupsConflict(group, candidate)
            ? count + 1
            : count,
        0,
      ),
      originalIndex,
      span: intervalSpan(group.intervals),
    }))
    .sort(
      (first, second) =>
        second.productAsins.length - first.productAsins.length ||
        second.conflictCount - first.conflictCount ||
        second.span - first.span ||
        compareText(first.series, second.series) ||
        first.originalIndex - second.originalIndex,
    );
}

function canShareLane(group: SeriesGroup, lane: PackedLane): boolean {
  return group.intervals.every((groupInterval) =>
    lane.intervals.every(
      (laneInterval) => !intervalsOverlap(groupInterval, laneInterval),
    ),
  );
}

export function packSeriesLanes(
  groups: SeriesGroup[],
  maxLanes = 3,
): SeriesLane[] {
  const preferredLaneCount =
    Number.isFinite(maxLanes) && maxLanes > 0 ? Math.floor(maxLanes) : 3;
  const lanes: PackedLane[] = [];

  for (const group of rankGroups(groups)) {
    const preferredLanes = lanes.slice(0, preferredLaneCount);
    const overflowLanes = lanes.slice(preferredLaneCount);
    let lane = [...preferredLanes, ...overflowLanes].find((candidate) =>
      canShareLane(group, candidate),
    );

    if (!lane) {
      lane = {
        index: lanes.length,
        series: [],
        productAsins: [],
        intervals: [],
      };
      lanes.push(lane);
    }

    lane.series.push(group.series);
    lane.productAsins.push(...group.productAsins);
    lane.intervals.push(...group.intervals);
  }

  return lanes.map(({ index, series, productAsins }) => ({
    index,
    series,
    productAsins,
  }));
}
