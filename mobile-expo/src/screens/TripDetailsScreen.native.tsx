import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme/appTheme';
import {TripDetailsScreenProps} from '../navigation/types';
import {getMockTripById, type MockTrip} from '../mocks/trackingData';
import {RouteSpeedMap} from '../components/RouteSpeedMap';
import {TripRouteInsightsCard} from '../components/TripRouteInsightsCard';
import {createTimedRouteFallback, getRouteSummary} from '../utils/tripRoute';
import {mapTripDetailToMockTrip, tripsService} from '../services/tripsService';

export const TripDetailsScreen: React.FC<TripDetailsScreenProps> = ({navigation, route}) => {
  const theme = useAppTheme();
  const fallbackTrip = useMemo(() => getMockTripById(route.params.tripId), [route.params.tripId]);
  const [trip, setTrip] = useState<MockTrip>(fallbackTrip);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadTrip = async () => {
      try {
        const backendTrip = await tripsService.getTripDetail(route.params.tripId);
        if (!cancelled) {
          setTrip(mapTripDetailToMockTrip(backendTrip));
        }
      } catch {
        if (!cancelled) {
          setTrip(fallbackTrip);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTrip();

    return () => {
      cancelled = true;
    };
  }, [fallbackTrip, route.params.tripId]);

  const routePoints = trip.routePoints?.length ? trip.routePoints : createTimedRouteFallback(trip.coordinates, '2026-05-10T09:00:00+05:30');
  const summary = getRouteSummary(routePoints);

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: theme.screen}}>
      <View style={{flex: 1, paddingHorizontal: 20, paddingTop: 12}}>
        <View style={{marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{backgroundColor: theme.card, borderColor: theme.cardBorder, height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1}}>
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={{color: theme.text, ...theme.typography.pageTitle, fontSize: 22, lineHeight: 26}}>Trip Details</Text>
          <TouchableOpacity
            style={{backgroundColor: theme.card, borderColor: theme.cardBorder, height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1}}>
            <Ionicons name="share-social-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
        <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginBottom: 12}}>
          {loading ? 'Loading trip details...' : 'Trip details and route insights'}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 120}}>
          <TripRouteInsightsCard
            trip={trip}
            summary={summary}
            mapContent={
              <RouteSpeedMap
                routePoints={routePoints}
                startLabel={`${trip.title} ${trip.startTime}`}
                endLabel={`${trip.subtitle} ${trip.endTime}`}
              />
            }
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
