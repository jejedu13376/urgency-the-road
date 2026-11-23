import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import type { PlaceDetailsData, PlaceReview } from '../../services/geo/googlePlacesDetails';

export type PlaceReviewsPanelProps = {
  /** When false, panel is hidden. */
  visible: boolean;
  busy?: boolean;
  /** Honest status when key missing / fetch failed / empty avis. */
  statusMessage?: string | null;
  details?: PlaceDetailsData | null;
  onClose: () => void;
  /** Max avis rows (default 3). */
  maxReviews?: number;
  /** Absolute inset from GpsFullMap (bottom / left / right). */
  style?: StyleProp<ViewStyle>;
};

function starLine(rating: number | undefined): string {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return '☆☆☆☆☆';
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(full)}${'☆'.repeat(5 - full)}`;
}

function reviewStars(r: PlaceReview): string {
  return starLine(r.rating);
}

/**
 * Compact French avis card for a selected Places POI (GpsFullMap).
 * Kept separate so itinerary / destination menu work can share GpsFullMap without a merge fight.
 */
export function PlaceReviewsPanel({
  visible,
  busy = false,
  statusMessage,
  details,
  onClose,
  maxReviews = 3,
  style,
}: PlaceReviewsPanelProps) {
  if (!visible) return null;

  const title = details?.displayName || details?.label || 'Lieu sélectionné';
  const reviews = (details?.reviews ?? []).slice(0, maxReviews);
  const hasRating = typeof details?.rating === 'number';
  const count = details?.userRatingCount;

  return (
    <View style={[styles.wrap, style]} accessibilityLabel="Avis Google du lieu">
      <View style={styles.head}>
        <View style={styles.headTxt}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size="small" color={colors.signal} />
              <Text style={styles.meta}>Chargement des avis…</Text>
            </View>
          ) : hasRating ? (
            <Text style={styles.meta} numberOfLines={1}>
              {starLine(details?.rating)}{' '}
              <Text style={styles.ratingNum}>{details!.rating!.toFixed(1)}</Text>
              {typeof count === 'number' ? ` · ${count} avis` : ''}
            </Text>
          ) : statusMessage ? (
            <Text style={styles.meta} numberOfLines={2}>
              {statusMessage}
            </Text>
          ) : (
            <Text style={styles.meta}>Pas de note Google pour ce lieu</Text>
          )}
        </View>
        <Pressable
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Fermer les avis"
        >
          <Text style={styles.closeTxt}>✕</Text>
        </Pressable>
      </View>

      {!busy && reviews.length > 0
        ? reviews.map((r, i) => (
            <View key={`${r.author ?? 'a'}-${i}`} style={styles.review}>
              <Text style={styles.reviewMeta} numberOfLines={1}>
                {reviewStars(r)}
                {r.author ? ` · ${r.author}` : ''}
                {r.relativeTime ? ` · ${r.relativeTime}` : ''}
              </Text>
              <Text style={styles.reviewTxt} numberOfLines={3}>
                {r.text}
              </Text>
            </View>
          ))
        : null}

      {!busy && !statusMessage && hasRating && reviews.length === 0 ? (
        <Text style={styles.empty}>Aucun avis texte disponible pour ce lieu</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(247,244,239,0.97)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    maxHeight: 220,
    zIndex: 25,
    elevation: 25,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headTxt: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 3, lineHeight: 15 },
  ratingNum: { color: colors.ink, fontWeight: '800' },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.mist,
  },
  closeTxt: { color: colors.slate, fontWeight: '800', fontSize: 12 },
  review: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  reviewMeta: { color: colors.slate, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  reviewTxt: { color: colors.ink, fontSize: 11, fontWeight: '500', lineHeight: 15 },
  empty: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 8 },
});
