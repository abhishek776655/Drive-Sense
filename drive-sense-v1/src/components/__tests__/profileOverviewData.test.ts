import {PROFILE_MENU_ITEMS, resolveProfileMenuRoute} from '../profileOverviewData';

describe('resolveProfileMenuRoute', () => {
  it('maps every profile menu item to a destination', () => {
    const expected: Record<string, ReturnType<typeof resolveProfileMenuRoute>> = {
      'My Vehicles': {tab: 'VehiclesStack', screen: 'VehicleList'},
      'Trips History': {tab: 'TripsStack', screen: 'TripsList'},
      Settings: {tab: 'ProfileStack', screen: 'Settings'},
      'Help & Support': {tab: 'ProfileStack', screen: 'HelpSupport'},
      'About Drive Sense': {tab: 'ProfileStack', screen: 'About'},
    };

    for (const item of PROFILE_MENU_ITEMS) {
      expect(resolveProfileMenuRoute(item.label)).toEqual(expected[item.label]);
    }
  });

  it('offers no menu item that leads to an unbuilt screen', () => {
    for (const item of PROFILE_MENU_ITEMS) {
      expect(resolveProfileMenuRoute(item.label)).not.toHaveProperty('comingSoon');
    }
  });

  it('falls back to a coming-soon destination for an unknown label', () => {
    expect(resolveProfileMenuRoute('Something New')).toEqual({comingSoon: 'Something New'});
  });
});
