import { useSideNav, type MenuItem } from '../useSideNav';

const menuItems: MenuItem[] = [
  {
    label: 'Measure',
    icon: 'pi pi-chart-line',
    route: '/tracsV2',
  },
  {
    label: 'Calibration',
    icon: 'pi pi-sliders-h',
    route: '/tracsV2/calibration',
  },
  {
    label: 'Test Results',
    icon: 'pi pi-check-square',
    route: '/tracsV2/test-results',
  },
  {
    label: 'Database',
    icon: 'pi pi-database',
    route: '/tracsV2/database',
  },
  {
    label: 'Link Support',
    icon: 'pi pi-link',
    route: '/tracsV2/link-support',
  },
];

export const { initMenu, side_nav_config } = useSideNav(
  'TRACS V2',
  '/tc.gif',
  menuItems,
  '55%'
);
