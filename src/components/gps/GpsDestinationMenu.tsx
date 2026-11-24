/**
 * Itinerary sheet — Maps-inspired actions, Urgency Road chrome (no Google clone).
 * Dyslexia-friendly: large type, short labels, high contrast, clear spacing.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  formatCad,
} from '../../services/geo/routeCostEstimate';
import type {
  ItineraryPlanResult,
  ItineraryRouteOption,
  RouteAvoidOptions,
} from '../../services/geo/planItinerary';
import { DEFAULT_ROUTE_AVOID } from '../../services/geo/tomtomRoute';
import type { GpsVehicleMode } from '../../services/prefs/gpsNavPrefs';
import {
  formatMyLocationShareLine,
  formatPlaceShareLine,
  savePlace,
  updatePlaceTag,
  type GpsPlaceRef,
} from '../../services/prefs/gpsSavedPlaces';
import { colors } from '../../theme/colors';

export type GpsDestinationSelection = {
  lat: number;
  lon: number;
  label: string;
  tag?: string;
};

export type GpsWaypoint = {
  id: string;
  lat: number;
  lon: number;
  label: string;
};

/** Route state for Démarrer — never conflate pending vs failed. */
export type GpsRouteStatus = 'pending' | 'ready' | 'failed';

type Props = {
  visible: boolean;
  destination: GpsDestinationSelection | null;
  getMyLocation: () => { lat: number; lon: number } | null;
  routeStatus: GpsRouteStatus;
  vehicleMode: GpsVehicleMode;
  avoid: RouteAvoidOptions;
  waypoints: GpsWaypoint[];
  plan: ItineraryPlanResult | null;
  selectedOptionIndex: number;
  planBusy?: boolean;
  onClose: () => void;
  onStartNavigation: () => boolean;
  onVehicleModeChange: (mode: GpsVehicleMode) => void;
  onAvoidChange: (patch: Partial<RouteAvoidOptions>) => void;
  onSelectOption: (index: number) => void;
  onAddWaypointRequest: () => void;
  onRemoveWaypoint: (id: string) => void;
  onLabelUpdated?: (place: GpsPlaceRef) => void;
  onFeedback?: (note: string) => void;
  onOpenHistory?: () => void;
  onSaveMyLocation?: () => void;
};

const DATA_SOURCES_FR =
  'Sources : TomTom routing (clé) ou Valhalla FOSSGIS · Places · Esri/Carto/OSM · TomTom flow trafic. Essence/péages = estimés si API sans montant.';

function CarAvatar({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.avatar, selected && styles.avatarOnCar]}>
      <Svg width={40} height={40} viewBox="0 0 64 64" accessibilityLabel="Voiture">
        <Path d="M12 30 L20 18 H44 L52 30 Z" fill={colors.signal} />
        <Rect x="10" y="30" width="44" height="14" rx="5" fill={colors.slate} />
        <Circle cx="20" cy="46" r="5.5" fill={colors.ink} />
        <Circle cx="44" cy="46" r="5.5" fill={colors.ink} />
        <Rect x="16" y="33" width="10" height="6" rx="1.5" fill={colors.mist} />
        <Rect x="38" y="33" width="10" height="6" rx="1.5" fill={colors.mist} />
      </Svg>
    </View>
  );
}

function TruckAvatar({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.avatar, selected && styles.avatarOnTruck]}>
      <Svg width={40} height={40} viewBox="0 0 64 64" accessibilityLabel="Camion">
        <Rect x="4" y="20" width="32" height="22" rx="3" fill={colors.garage} />
        <Rect x="36" y="26" width="22" height="16" rx="3" fill={colors.signal} />
        <Rect x="40" y="29" width="10" height="7" rx="1.5" fill={colors.signalSoft} />
        <Circle cx="16" cy="46" r="5.5" fill={colors.ink} />
        <Circle cx="48" cy="46" r="5.5" fill={colors.ink} />
        <Rect x="8" y="24" width="12" height="8" rx="1" fill={colors.garageSoft} />
      </Svg>
    </View>
  );
}

export function GpsDestinationMenu({
  visible,
  destination,
  getMyLocation,
  routeStatus,
  vehicleMode,
  avoid,
  waypoints,
  plan,
  selectedOptionIndex,
  planBusy,
  onClose,
  onStartNavigation,
  onVehicleModeChange,
  onAvoidChange,
  onSelectOption,
  onAddWaypointRequest,
  onRemoveWaypoint,
  onLabelUpdated,
  onFeedback,
  onOpenHistory,
  onSaveMyLocation,
}: Props) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [tagModal, setTagModal] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheetNote, setSheetNote] = useState<string | null>(null);

  const selected: ItineraryRouteOption | null = useMemo(() => {
    if (!plan?.ok || !plan.options.length) return null;
    return plan.options[selectedOptionIndex] ?? plan.options[0] ?? null;
  }, [plan, selectedOptionIndex]);

  const dismiss = useCallback(() => {
    setSheetNote(null);
    setPlusOpen(false);
    setTagModal(false);
    onClose();
  }, [onClose]);

  const feedback = useCallback(
    (note: string) => {
      setSheetNote(note);
      onFeedback?.(note);
    },
    [onFeedback],
  );

  const onStart = useCallback(() => {
    if (!destination) return;
    if (!getMyLocation()) {
      feedback('Démarrer — GPS appareil requis');
      return;
    }
    if (routeStatus === 'pending' || planBusy) {
      feedback('Calcul itinéraire en cours — réessayez dans un instant');
      return;
    }
    if (routeStatus === 'failed' || !selected) {
      feedback('Itinéraire indisponible — autre adresse ou options');
      return;
    }
    const started = onStartNavigation();
    if (!started) {
      feedback('Navigation non démarrée — GPS ou itinéraire manquant');
      return;
    }
    dismiss();
  }, [
    destination,
    routeStatus,
    planBusy,
    selected,
    getMyLocation,
    onStartNavigation,
    dismiss,
    feedback,
  ]);

  const onShare = useCallback(async () => {
    if (!destination) return;
    try {
      const eta = selected
        ? `\n~${selected.durationMin} min · ${selected.distanceKm} km`
        : '';
      const fuel = selected ? `\n${selected.fuelLabel}` : '';
      const toll =
        selected?.hasTolls || (selected?.tollCostCad != null && selected.tollCostCad > 0)
          ? `\n${selected.tollLabel}`
          : '';
      const stops =
        waypoints.length > 0
          ? `\nÉtapes: ${waypoints.map((w) => w.label).join(' → ')}`
          : '';
      const message = `${formatPlaceShareLine(destination)}${eta}${fuel}${toll}${stops}`;
      const res = await Share.share({
        message,
        title: 'Itinéraire',
        url:
          Platform.OS === 'ios'
            ? `https://www.openstreetmap.org/?mlat=${destination.lat}&mlon=${destination.lon}`
            : undefined,
      });
      feedback(res.action === Share.sharedAction ? 'Itinéraire partagé' : 'Partage annulé');
    } catch (e) {
      feedback(e instanceof Error ? e.message : 'Partage KO');
    }
  }, [destination, selected, waypoints, feedback]);

  const onShareMyLocation = useCallback(async () => {
    const myLocation = getMyLocation();
    if (!myLocation) {
      feedback('Partage position — GPS appareil requis');
      return;
    }
    try {
      const message = formatMyLocationShareLine(myLocation.lat, myLocation.lon);
      const res = await Share.share({
        message,
        title: 'Ma position',
        url:
          Platform.OS === 'ios'
            ? `https://www.openstreetmap.org/?mlat=${myLocation.lat}&mlon=${myLocation.lon}`
            : undefined,
      });
      feedback(res.action === Share.sharedAction ? 'Position partagée' : 'Partage annulé');
    } catch (e) {
      feedback(e instanceof Error ? e.message : 'Partage KO');
    }
  }, [getMyLocation, feedback]);

  const onSavePlace = useCallback(async () => {
    if (!destination) return;
    setBusy(true);
    try {
      const r = await savePlace({
        lat: destination.lat,
        lon: destination.lon,
        label: destination.label,
      });
      if (!r.ok) {
        feedback(r.error);
        return;
      }
      feedback(`Lieu enregistré · ${r.place.tag ? r.place.tag + ' · ' : ''}${r.place.label}`);
      onLabelUpdated?.(r.place);
    } finally {
      setBusy(false);
    }
  }, [destination, feedback, onLabelUpdated]);

  const openTagEditor = useCallback(() => {
    if (!destination) return;
    setTagDraft(destination.tag ?? '');
    setTagModal(true);
  }, [destination]);

  const commitTag = useCallback(async () => {
    if (!destination) return;
    setBusy(true);
    try {
      const r = await updatePlaceTag(
        destination.lat,
        destination.lon,
        tagDraft,
        destination.label,
      );
      if (!r.ok) {
        feedback(r.error);
        return;
      }
      feedback(
        r.place.tag
          ? `Étiquette « ${r.place.tag} » enregistrée`
          : 'Étiquette retirée — lieu conservé',
      );
      onLabelUpdated?.(r.place);
      setTagModal(false);
    } finally {
      setBusy(false);
    }
  }, [destination, tagDraft, feedback, onLabelUpdated]);

  const stubAction = useCallback(
    (title: string) => {
      feedback(`${title} — pas encore disponible (stub honnête)`);
    },
    [feedback],
  );

  if (!destination) return null;

  const startHint =
    planBusy || routeStatus === 'pending'
      ? 'calcul…'
      : routeStatus === 'failed'
        ? 'indisponible'
        : undefined;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={dismiss}>
        <Pressable
          style={styles.backdrop}
          onPress={dismiss}
          accessibilityLabel="Fermer l’itinéraire"
        />
        <View style={styles.sheet} accessibilityLabel="Itinéraire">
          <View style={styles.handle} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollPad}
          >
            <Text style={styles.title} numberOfLines={2}>
              {destination.tag ? `${destination.tag} · ` : ''}
              {destination.label}
            </Text>

            {/* 1) Temps + distance */}
            <View style={styles.etaBlock} accessibilityLiveRegion="polite">
              {planBusy ? (
                <View style={styles.etaRow}>
                  <ActivityIndicator color={colors.signal} />
                  <Text style={styles.etaPending}>Calcul du trajet…</Text>
                </View>
              ) : selected ? (
                <>
                  <Text style={styles.etaBig}>
                    {selected.durationMin} min
                    <Text style={styles.etaSep}> · </Text>
                    {selected.distanceKm} km
                  </Text>
                  <Text style={styles.etaSub} numberOfLines={2}>
                    {selected.title}
                    {plan?.engine ? ` · ${plan.engine}` : ''}
                  </Text>
                </>
              ) : (
                <Text style={styles.etaPending}>
                  {routeStatus === 'failed'
                    ? 'Itinéraire indisponible'
                    : 'En attente du trajet…'}
                </Text>
              )}
            </View>

            {/* 8 + 9) Péages + essence */}
            {selected ? (
              <View style={styles.costRow}>
                <View style={styles.costChip}>
                  <Text style={styles.costLabel}>Essence</Text>
                  <Text style={styles.costVal}>
                    ~{formatCad(selected.fuelCostCad)}
                  </Text>
                  <Text style={styles.costHint} numberOfLines={1}>
                    {selected.fuelLiters} L
                  </Text>
                </View>
                <View style={styles.costChip}>
                  <Text style={styles.costLabel}>Péages</Text>
                  <Text style={styles.costVal}>
                    {selected.tollCostCad != null && selected.tollCostCad > 0
                      ? `~${formatCad(selected.tollCostCad)}`
                      : selected.hasTolls
                        ? 'Oui'
                        : 'Non'}
                  </Text>
                  <Text style={styles.costHint} numberOfLines={1}>
                    {selected.hasTolls
                      ? `${selected.tollSectionKm} km`
                      : 'aucun'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* 7) Véhicule camion|voiture + avatar */}
            <Text style={styles.sectionLabel}>Véhicule</Text>
            <View style={styles.vehicleRow}>
              <Pressable
                style={[
                  styles.vehicleBtn,
                  vehicleMode === 'voiture' && styles.vehicleBtnOn,
                ]}
                onPress={() => onVehicleModeChange('voiture')}
                accessibilityRole="button"
                accessibilityState={{ selected: vehicleMode === 'voiture' }}
                accessibilityLabel="Mode voiture"
              >
                <CarAvatar selected={vehicleMode === 'voiture'} />
                <Text
                  style={[
                    styles.vehicleTxt,
                    vehicleMode === 'voiture' && styles.vehicleTxtOn,
                  ]}
                >
                  Voiture
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.vehicleBtn,
                  vehicleMode === 'camion' && styles.vehicleBtnOnTruck,
                ]}
                onPress={() => onVehicleModeChange('camion')}
                accessibilityRole="button"
                accessibilityState={{ selected: vehicleMode === 'camion' }}
                accessibilityLabel="Mode camion"
              >
                <TruckAvatar selected={vehicleMode === 'camion'} />
                <Text
                  style={[
                    styles.vehicleTxt,
                    vehicleMode === 'camion' && styles.vehicleTxtOnTruck,
                  ]}
                >
                  Camion
                </Text>
              </Pressable>
            </View>

            {/* 10) 2–3 options d'itinéraire */}
            {plan?.ok && plan.options.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Itinéraires</Text>
                <View style={styles.optRow}>
                  {plan.options.slice(0, 3).map((opt, i) => {
                    const on = i === selectedOptionIndex;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[styles.optChip, on && styles.optChipOn]}
                        onPress={() => onSelectOption(i)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.optTitle, on && styles.optTitleOn]}>
                          {opt.title}
                        </Text>
                        <Text style={[styles.optMeta, on && styles.optMetaOn]}>
                          {opt.durationMin} min
                        </Text>
                        <Text style={[styles.optMeta, on && styles.optMetaOn]}>
                          {opt.distanceKm} km
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* 6) Options éviter + éco */}
            <Text style={styles.sectionLabel}>Options</Text>
            <View style={styles.avoidGrid}>
              {(
                [
                  ['avoidTolls', 'Éviter péages'],
                  ['avoidHighways', 'Éviter autoroutes'],
                  ['avoidFerries', 'Éviter traversiers'],
                  ['eco', 'Éco'],
                ] as const
              ).map(([key, label]) => {
                const on = avoid[key];
                return (
                  <Pressable
                    key={key}
                    style={[styles.avoidChip, on && styles.avoidChipOn]}
                    onPress={() => onAvoidChange({ [key]: !on })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={label}
                  >
                    <Text style={[styles.avoidTxt, on && styles.avoidTxtOn]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 3) Ajouter des étapes */}
            <Text style={styles.sectionLabel}>Étapes</Text>
            {waypoints.map((w) => (
              <View key={w.id} style={styles.stopRow}>
                <Text style={styles.stopTxt} numberOfLines={1}>
                  {w.label}
                </Text>
                <Pressable
                  onPress={() => onRemoveWaypoint(w.id)}
                  accessibilityLabel={`Retirer étape ${w.label}`}
                  hitSlop={8}
                >
                  <Text style={styles.stopRemove}>Retirer</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={styles.addStop}
              onPress={onAddWaypointRequest}
              accessibilityRole="button"
              accessibilityLabel="Ajouter des étapes"
            >
              <Text style={styles.addStopTxt}>+ Ajouter des étapes</Text>
            </Pressable>

            {sheetNote ? (
              <View style={styles.sheetNote} accessibilityLiveRegion="polite">
                <Text style={styles.sheetNoteTxt}>{sheetNote}</Text>
              </View>
            ) : null}

            {/* 2) Démarrer · 4) Partager · 5) Enregistrer */}
            <ActionRow
              label="Démarrer"
              emphasis
              disabled={busy || !!planBusy}
              onPress={onStart}
              hint={startHint}
            />
            <ActionRow
              label="Partager"
              disabled={busy}
              onPress={() => void onShare()}
            />
            <ActionRow
              label="Enregistrer"
              disabled={busy}
              onPress={() => void onSavePlace()}
            />

            <Pressable
              style={styles.plusToggle}
              onPress={() => setPlusOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: plusOpen }}
            >
              <Text style={styles.plusToggleTxt}>{plusOpen ? 'Moins' : 'Plus'}</Text>
            </Pressable>

            {plusOpen ? (
              <View style={styles.plusBlock}>
                <ActionRow
                  label="Partager ma location"
                  muted
                  onPress={() => void onShareMyLocation()}
                />
                {onSaveMyLocation ? (
                  <ActionRow
                    label="Enregistrer ma position GPS"
                    muted
                    onPress={() => onSaveMyLocation()}
                  />
                ) : null}
                <ActionRow
                  label="Modifier ou ajouter une étiquette"
                  muted
                  disabled={busy}
                  onPress={openTagEditor}
                />
                <ActionRow
                  label="Ajouter au contact"
                  muted
                  onPress={() => stubAction('Ajouter au contact')}
                />
                <ActionRow
                  label="Télécharger la carte hors ligne"
                  muted
                  onPress={() => stubAction('Carte hors ligne')}
                />
                <ActionRow
                  label="Voir la chronologie des trajets"
                  muted
                  onPress={() => {
                    if (onOpenHistory) {
                      dismiss();
                      onOpenHistory();
                      return;
                    }
                    stubAction('Chronologie des trajets');
                  }}
                />
                <ActionRow
                  label="À propos des sources de données"
                  muted
                  onPress={() => feedback(DATA_SOURCES_FR)}
                />
              </View>
            ) : null}

            <Pressable style={styles.closeBtn} onPress={dismiss}>
              <Text style={styles.closeTxt}>Fermer</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={tagModal} animationType="fade" transparent onRequestClose={() => setTagModal(false)}>
        <View style={styles.tagBackdrop}>
          <View style={styles.tagCard}>
            <Text style={styles.tagTitle}>Étiquette</Text>
            <TextInput
              value={tagDraft}
              onChangeText={setTagDraft}
              placeholder="Maison, dépôt, client…"
              placeholderTextColor={colors.muted}
              style={styles.tagInput}
              maxLength={48}
              autoFocus
              accessibilityLabel="Étiquette du lieu"
            />
            <View style={styles.tagActions}>
              <Pressable style={styles.tagGhost} onPress={() => setTagModal(false)}>
                <Text style={styles.tagGhostTxt}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.tagSave} onPress={() => void commitTag()} disabled={busy}>
                <Text style={styles.tagSaveTxt}>Enregistrer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ActionRow({
  label,
  onPress,
  emphasis,
  muted,
  disabled,
  hint,
}: {
  label: string;
  onPress: () => void;
  emphasis?: boolean;
  muted?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Pressable
      style={[styles.row, emphasis && styles.rowEmphasis, muted && styles.rowMuted]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.rowTxt,
          emphasis && styles.rowTxtEmphasis,
          muted && styles.rowTxtMuted,
        ]}
      >
        {label}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </Pressable>
  );
}

/** Re-export for callers that still import the default avoid bag. */
export { DEFAULT_ROUTE_AVOID };

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,24,32,0.35)',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    maxHeight: '82%',
  },
  scrollPad: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    marginBottom: 10,
    letterSpacing: 0.15,
  },
  etaBlock: {
    backgroundColor: colors.mist,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  etaBig: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  etaSep: { color: colors.muted, fontWeight: '600' },
  etaSub: {
    marginTop: 4,
    color: colors.slate,
    fontSize: 14,
    fontWeight: '600',
  },
  etaPending: {
    color: colors.slate,
    fontSize: 16,
    fontWeight: '700',
  },
  costRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  costChip: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  costLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  costVal: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  costHint: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionLabel: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  vehicleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  vehicleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  vehicleBtnOn: {
    borderColor: colors.signal,
    backgroundColor: colors.signalSoft,
  },
  vehicleBtnOnTruck: {
    borderColor: colors.garage,
    backgroundColor: colors.garageSoft,
  },
  vehicleTxt: {
    color: colors.slate,
    fontSize: 16,
    fontWeight: '800',
  },
  vehicleTxtOn: { color: colors.signal },
  vehicleTxtOnTruck: { color: colors.garage },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.line,
  },
  avatarOnCar: { borderColor: colors.signal },
  avatarOnTruck: { borderColor: colors.garage },
  optRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  optChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  optChipOn: {
    borderColor: colors.signal,
    backgroundColor: colors.signalSoft,
  },
  optTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  optTitleOn: { color: colors.signal },
  optMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  optMetaOn: { color: colors.slate },
  avoidGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  avoidChip: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  avoidChipOn: {
    borderColor: colors.garage,
    backgroundColor: colors.garageSoft,
  },
  avoidTxt: {
    color: colors.slate,
    fontSize: 14,
    fontWeight: '700',
  },
  avoidTxtOn: { color: colors.garage },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  stopTxt: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  stopRemove: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  addStop: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  addStopTxt: {
    color: colors.signal,
    fontSize: 16,
    fontWeight: '800',
  },
  sheetNote: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  sheetNoteTxt: {
    color: colors.slate,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowEmphasis: {
    backgroundColor: colors.signalSoft,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  rowMuted: { opacity: 0.92 },
  rowTxt: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  rowTxtEmphasis: {
    color: colors.signal,
    fontWeight: '800',
    fontSize: 18,
  },
  rowTxtMuted: {
    color: colors.slate,
    fontWeight: '600',
    fontSize: 15,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  plusToggle: {
    marginTop: 10,
    paddingVertical: 10,
  },
  plusToggleTxt: {
    color: colors.slate,
    fontWeight: '800',
    fontSize: 15,
  },
  plusBlock: { marginBottom: 4 },
  closeBtn: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeTxt: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 15,
  },
  tagBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,24,32,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  tagCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
  },
  tagTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 10,
  },
  tagInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 14,
  },
  tagActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  tagGhost: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tagGhostTxt: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 15,
  },
  tagSave: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tagSaveTxt: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
});
