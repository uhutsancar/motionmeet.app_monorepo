import React from 'react';
import MonthMetricDetail from '../components/stats/MonthMetricDetail';
import type { BaseNavigationScreenProps } from '../navigation/types';

const SetsDetailScreen = (props: BaseNavigationScreenProps) => <MonthMetricDetail {...props} metric="sets" />;

export default SetsDetailScreen;
