import React from 'react';
import MonthMetricDetail from '../components/stats/MonthMetricDetail';
import type { BaseNavigationScreenProps } from '../navigation/types';

const DurationDetailScreen = (props: BaseNavigationScreenProps) => <MonthMetricDetail {...props} metric="duration" />;

export default DurationDetailScreen;
