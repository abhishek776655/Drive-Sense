import React, {useEffect, useState} from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme/appTheme';
import {TripDetailsScreenProps} from '../navigation/types';
import type {MockTrip} from '../mocks/trackingData';
import {RouteSpeedMap} from '../components/RouteSpeedMap';
import {TripRouteInsightsCard} from '../components/TripRouteInsightsCard';
import {getRouteSummary} from '../utils/tripRoute';
import {mapTripDetailToMockTrip, tripsService} from '../services/tripsService';

export const TripDetailsScreen: React.FC<TripDetailsScreenProps> = ({navigation, route}) => {
  const theme = useAppTheme();
  const [trip, setTrip] = useState<MockTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadTrip = async () => {
      try {
        const backendTrip = await tripsService.getTripDetail(route.params.tripId);
        if (!cancelled) {
          setTrip(mapTripDetailToMockTrip(backendTrip));
          setError('');
        }
      } catch {
        if (!cancelled) {
          setTrip(null);
          setError('Unable to load this trip from the API.');
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
  }, [route.params.tripId]);

  const routePoints = trip?.routePoints ?? [];
  const summary = getRouteSummary(routePoints);

  const handleShare = () => {
    if (!trip) {
      return;
    }
    const text = `My ${trip.title} trip (${trip.date}): ${trip.distance} in ${trip.duration}, driving score ${trip.drivingScore}. Tracked with DriveSense.`;
    const nav = typeof navigator === 'undefined' ? null : (navigator as Navigator & {share?: (data: {text: string}) => Promise<void>});
    if (nav?.share) {
      void nav.share({text}).catch(() => {});
    } else if (nav?.clipboard) {
      void nav.clipboard.writeText(text).catch(() => {});
    }
  };

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
            onPress={handleShare}
            disabled={!trip}
            style={{backgroundColor: theme.card, borderColor: theme.cardBorder, height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, opacity: trip ? 1 : 0.5}}>
            <Ionicons name="share-social-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
        <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginBottom: 12}}>
          {loading ? 'Loading trip details...' : error || 'Trip details and route insights'}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 120}}>
          {trip ? (
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
          ) : !loading ? (
            <View className="rounded-3xl border p-5" style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}>
              <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Trip unavailable</Text>
              <Text style={{color: theme.textSubtle, ...theme.typography.body, marginTop: 8}}>
                {error || 'No API trip data was returned for this trip.'}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
