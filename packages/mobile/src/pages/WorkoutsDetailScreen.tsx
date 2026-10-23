import React from 'react';
import MonthMetricDetail from '../components/stats/MonthMetricDetail';
import type { BaseNavigationScreenProps } from '../navigation/types';

const WorkoutsDetailScreen = (props: BaseNavigationScreenProps) => <MonthMetricDetail {...props} metric="workouts" />;

export default WorkoutsDetailScreen;
