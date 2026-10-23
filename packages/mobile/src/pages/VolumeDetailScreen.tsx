import React from 'react';
import MonthMetricDetail from '../components/stats/MonthMetricDetail';
import type { BaseNavigationScreenProps } from '../navigation/types';

const VolumeDetailScreen = (props: BaseNavigationScreenProps) => <MonthMetricDetail {...props} metric="volume" />;

export default VolumeDetailScreen;
