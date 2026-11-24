import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { FormChoice } from '../../src/components/FormChoice';
import { ProgressHero } from '../../src/components/ProgressHero';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { VinCameraScanner } from '../../src/components/VinCameraScanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { useI18n } from '../../src/context/I18nContext';
import { CASCADE } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { loadCarnet } from '../../src/services/carnet/carnetStorage';
import { decodeVinRemote } from '../../src/services/firebase';
import { fetchRecallsByVehicle, type RecallHit } from '../../src/services/recalls/nhtsaRecalls';
import { estimateLocalFluids } from '../../src/services/vehicle/localFluids';
import { colors } from '../../src/theme/colors';
import type { MaintenanceItem } from '../../src/types/modules';
import type { ContinentCode, VehicleClass, VehicleProfile } from '../../src/types/vehicle';


type KindChoice = 'voiture' | 'camion';

/** Prefer i18n label; fall back to raw code when key is missing (e.g. VIN GB/MX). */
function tOrRaw(tFn: (key: string) => string, key: string, fallback: string): string {
  const out = tFn(key);
  if (!out || out === key || out.startsWith('[missing')) return fallback;
  return out;
}

function kindFromClass(vc?: VehicleClass): KindChoice {
  return vc === 'poids_lourd' ? 'camion' : 'voiture';
}

/** Keep pickup/SUV when staying on the light-vehicle side; only switch to PL when kind=camion. */
function resolveVehicleClass(kind: KindChoice, current?: VehicleClass): VehicleClass {
  if (kind === 'camion') return 'poids_lourd';
  if (current === 'pickup' || current === 'suv' || current === 'voiture') return current;
  return 'voiture';
}

function currencyFor(continent: ContinentCode, country: string): VehicleProfile['currency'] {
  if (country === 'CA') return 'CAD';
  if (country === 'US') return 'USD';
  if (country === 'AU' || continent === 'AU') return 'AUD';
  return 'EUR';
}

/** Minimum required maintenance rows (oil / vidange first). */
function buildMinMaintenance(
  active: VehicleProfile | null,
  open: MaintenanceItem[],
  oilTitle: string,
): MaintenanceItem[] {
  const fromCarnet = open.filter((m) => /vidange|huile|oil/i.test(m.title));
  const base: MaintenanceItem[] = fromCarnet.length
    ? fromCarnet
    : [
        {
          id: 'min-oil',
          title: oilTitle,
          dueKm: active ? active.odometerKm + 10000 : 10000,
          status: 'a_faire',
        },
      ];
  const extras = open
    .filter((m) => !/vidange|huile|oil/i.test(m.title))
    .slice(0, 2);
  return [...base, ...extras].slice(0, 4);
}

/** Module 1 — onglet primaire « Mon véhicule » = identification claire. */
export default function MonVehiculeScreen() {
  const { t } = useI18n();
  useModuleVisit(1);
  const { profile } = useAuth();
  const { active, vehicles, setActive, upsertVehicle, syncLabel, syncSource } = useFleet();
  const [vin, setVin] = useState(active?.vin ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sourceLabel, setSourceLabel] = useState<string | undefined>();
  const [recalls, setRecalls] = useState<RecallHit[]>([]);
  const [recallLabel, setRecallLabel] = useState<string | null>(null);
  const [recallsLoading, setRecallsLoading] = useState(false);
  const [odoDraft, setOdoDraft] = useState(active ? String(active.odometerKm) : '');
  const [reminders, setReminders] = useState<MaintenanceItem[]>([]);
  const [remindersLabel, setRemindersLabel] = useState<string | null>(null);

  const [kind, setKind] = useState<KindChoice>(kindFromClass(active?.vehicleClass));
  const [continent, setContinent] = useState<ContinentCode | null>(active?.continent ?? null);
  const [country, setCountry] = useState<string | null>(active?.country ?? null);

  const countries = useMemo(
    () => (continent ? CASCADE.countries[continent] ?? [] : []),
    [continent],
  );

  useEffect(() => {
    const tmr = setTimeout(() => {
      if (active?.vin) setVin(active.vin);
      if (active) setOdoDraft(String(active.odometerKm));
      if (active?.vehicleClass) setKind(kindFromClass(active.vehicleClass));
      if (active?.continent) setContinent(active.continent);
      if (active?.country) setCountry(active.country);
    }, 0);
    return () => clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: id/vin/odo/class/zone only
  }, [active?.id, active?.vin, active?.odometerKm, active?.vehicleClass, active?.continent, active?.country]);

  useFocusEffect(
    useCallback(() => {
      const vehicleKey = active?.id ?? active?.vin ?? 'default';
      let cancelled = false;
      void (async () => {
        const stored = await loadCarnet(vehicleKey);
        if (cancelled) return;
        const open = (stored?.maintenance ?? []).filter((m) => m.status !== 'fait').slice(0, 6);
        setReminders(open);
        setRemindersLabel(
          stored
            ? open.length
              ? null
              : t('monVehicule.carnetEmpty')
            : t('monVehicule.carnetNone'),
        );
      })();
      return () => {
        cancelled = true;
      };
    }, [active?.id, active?.vin, t]),
  );

  useEffect(() => {
    let cancelled = false;
    const tmr = setTimeout(() => {
      if (!active?.make || !active?.model || !active?.year) {
        setRecalls([]);
        setRecallLabel(null);
        setRecallsLoading(false);
        return;
      }
      setRecalls([]);
      setRecallLabel(null);
      setRecallsLoading(true);
      void (async () => {
        const res = await fetchRecallsByVehicle({
          make: active.make,
          model: active.model,
          year: active.year,
        });
        if (cancelled) return;
        setRecalls(res.items);
        setRecallLabel(res.label);
        setRecallsLoading(false);
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(tmr);
    };
  }, [active?.make, active?.model, active?.year]);

  const oilTitle = useMemo(() => {
    const oilL = active?.fluids.engineOilL;
    return oilL != null
      ? t('monVehicule.maintOilLiters', { liters: oilL })
      : t('monVehicule.maintOil');
  }, [active?.fluids.engineOilL, t]);

  const minMaint = useMemo(
    () => buildMinMaintenance(active, reminders, oilTitle),
    [active, reminders, oilTitle],
  );

  const applyDecoded = async (decoded: VehicleProfile, stub?: string) => {
    const sameVin = Boolean(active && active.vin && active.vin === decoded.vin);
    const merged: VehicleProfile = {
      ...decoded,
      label: sameVin && active?.label ? active.label : decoded.label,
      odometerKm: sameVin && active ? active.odometerKm : decoded.odometerKm,
    };
    upsertVehicle(merged);
    setKind(kindFromClass(merged.vehicleClass));
    setContinent(merged.continent);
    setCountry(merged.country);
    setSourceLabel(
      stub ??
        syncLabel ??
        (profile?.uid
          ? syncSource === 'firestore'
            ? 'Firestore via flotte'
            : 'Sync flotte…'
          : 'Local — connectez-vous pour sync Firestore'),
    );
    setMsg(
      profile?.uid
        ? `Fiche enregistrée : ${merged.make} ${merged.model} ${merged.year}`
        : `Fiche locale : ${merged.make} ${merged.model} ${merged.year}`,
    );
  };

  const onDecode = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await decodeVinRemote(vin);
      setSourceLabel(res.stubLabel);
      if (!res.data) {
        setMsg(res.stubLabel ?? t('monVehicule.vinShort'));
        return;
      }
      await applyDecoded(res.data, res.stubLabel);
    } finally {
      setBusy(false);
    }
  };

  const onVinFromCamera = async (scanned: string) => {
    setVin(scanned);
    setBusy(true);
    setMsg(null);
    try {
      const res = await decodeVinRemote(scanned);
      setSourceLabel(res.stubLabel ?? 'Scan caméra + NHTSA');
      if (res.data) await applyDecoded(res.data, res.stubLabel ?? 'Scan caméra + NHTSA');
      else setMsg(res.stubLabel ?? t('monVehicule.vinScanFail'));
    } finally {
      setBusy(false);
    }
  };

  const saveIdentification = () => {
    if (!continent || !country) {
      setMsg(t('monVehicule.idNeedZone'));
      return;
    }
    const vehicleClass = resolveVehicleClass(kind, active?.vehicleClass);
    const powertrain =
      kind === 'camion'
        ? 'poids_lourd_diesel'
        : active?.powertrain && active.powertrain !== 'poids_lourd_diesel'
          ? active.powertrain
          : 'essence';
    const fluids = estimateLocalFluids({
      vehicleClass,
      powertrain,
      make: active?.make,
    });
    const year = active?.year ?? new Date().getFullYear();
    const make =
      active?.make && active.make !== '—'
        ? active.make
        : kind === 'camion'
          ? t('monVehicule.kindTruck')
          : t('monVehicule.kindCar');
    const model = active?.model && active.model !== '—' ? active.model : t('monVehicule.idDraftModel');
    const next: VehicleProfile = {
      id: active?.id ?? `id-${Date.now()}`,
      label: active?.label ?? `${make} ${model}`,
      vin: active?.vin,
      continent,
      country,
      make,
      model,
      year,
      powertrain: active?.powertrain && kind === kindFromClass(active.vehicleClass) ? active.powertrain : powertrain,
      vehicleClass,
      fluids: active?.fluids && kind === kindFromClass(active.vehicleClass) ? active.fluids : fluids.fluids,
      fluidsSource:
        active?.fluidsSource && kind === kindFromClass(active.vehicleClass)
          ? active.fluidsSource
          : fluids.source,
      commonFailures: active?.commonFailures ?? [],
      odometerKm: active?.odometerKm ?? 0,
      unitSystem: continent === 'NA' ? 'imperial' : 'metric',
      currency: currencyFor(continent, country),
      techNotes: active?.techNotes,
      clientLocalId: active?.clientLocalId,
    };
    upsertVehicle(next);
    setMsg(
      t('monVehicule.idSaved', {
        kind: kind === 'camion' ? t('monVehicule.kindTruck') : t('monVehicule.kindCar'),
        country,
      }),
    );
  };

  const saveOdometer = () => {
    if (!active) return;
    const n = parseInt(odoDraft.replace(/\s/g, ''), 10);
    if (!Number.isFinite(n) || n < 0) {
      setMsg(t('monVehicule.odoInvalid'));
      return;
    }
    upsertVehicle({ ...active, odometerKm: n });
    setMsg(
      profile?.uid
        ? `Kilométrage sync flotte : ${n.toLocaleString('fr-FR')} km`
        : `Kilométrage local : ${n.toLocaleString('fr-FR')} km`,
    );
  };

  const onContinent = (c: ContinentCode) => {
    setContinent(c);
    const list = CASCADE.countries[c] ?? [];
    setCountry((cur) => (cur && list.includes(cur) ? cur : list[0] ?? null));
  };

  return (
    <Screen title={t('tabs.monVehicule')} subtitle={t('monVehicule.subtitle')}>
      <BackendStatusBanner />
      <ProgressHero />
      <StubBanner
        text={
          sourceLabel ??
          t('monVehicule.stubHint')
        }
      />
      <VinCameraScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onVin={(v) => void onVinFromCamera(v)}
      />

      {/* 1) Identification — dyslexia-friendly opaque form */}
      <Card title={t('monVehicule.idTitle')}>
        <Text style={styles.lead}>{t('monVehicule.idLead')}</Text>

        <FormChoice
          label={t('monVehicule.kindLabel')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'voiture', label: t('monVehicule.kindCar'), hint: t('monVehicule.kindCarHint') },
            { value: 'camion', label: t('monVehicule.kindTruck'), hint: t('monVehicule.kindTruckHint') },
          ]}
        />

        <FormChoice
          label={t('monVehicule.continentLabel')}
          value={continent}
          onChange={onContinent}
          options={CASCADE.continents.map((c) => ({
            value: c.id as ContinentCode,
            label: tOrRaw(t, `monVehicule.continent.${c.id}`, c.label),
          }))}
        />

        {continent ? (
          <FormChoice
            label={t('monVehicule.countryLabel')}
            value={country}
            onChange={setCountry}
            options={countries.map((code) => ({
              value: code,
              label: tOrRaw(t, `monVehicule.country.${code}`, code),
              hint: code,
            }))}
          />
        ) : null}

        <Pressable
          style={styles.primary}
          onPress={saveIdentification}
          accessibilityRole="button"
          accessibilityLabel={t('monVehicule.idSave')}
        >
          <Text style={styles.primaryTxt}>{t('monVehicule.idSave')}</Text>
        </Pressable>
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </Card>

      {/* VIN */}
      <Card title={t('monVehicule.searchTitle')}>
        <Text style={styles.hint}>{t('monVehicule.vinHint')}</Text>
        <Text style={styles.fieldLabel}>{t('monVehicule.vinLabel')}</Text>
        <TextInput
          value={vin}
          onChangeText={setVin}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="VF1RJA00067000001"
          placeholderTextColor={colors.muted}
          style={styles.input}
          accessibilityLabel={t('monVehicule.vinLabel')}
        />
        <View style={styles.row}>
          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            onPress={() => void onDecode()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('monVehicule.vinDecode')}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryTxt}>{t('monVehicule.vinDecode')}</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.secondary, busy && styles.disabled]}
            onPress={() => setScannerOpen(true)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('monVehicule.vinScan')}
          >
            <Text style={styles.secondaryTxt}>{t('monVehicule.vinScan')}</Text>
          </Pressable>
        </View>
      </Card>

      {/* Carfax / historique */}
      <Card title={t('monVehicule.carfaxTitle')}>
        <Text style={styles.lead}>{t('monVehicule.carfaxLead')}</Text>
        {!active?.make || !active?.model || !active?.year ? (
          <Text style={styles.hint}>{t('monVehicule.carfaxNeedFiche')}</Text>
        ) : recallsLoading ? (
          <Text style={styles.hint}>{t('monVehicule.carfaxLoading')}</Text>
        ) : (
          <>
            <Text style={styles.hint}>{recallLabel ?? t('monVehicule.carfaxSource')}</Text>
            {recalls.length === 0 ? (
              <Text style={styles.hint}>{t('monVehicule.carfaxEmpty')}</Text>
            ) : (
              recalls.slice(0, 6).map((r) => (
                <View key={r.id} style={styles.block}>
                  <Text style={styles.blockTitle}>{r.title}</Text>
                  <Text style={styles.blockBody}>
                    {r.component ? `${r.component} · ` : ''}
                    {r.source} · {r.severity}
                  </Text>
                </View>
              ))
            )}
            {active.commonFailures.length > 0 ? (
              <>
                <Text style={styles.section}>{t('monVehicule.carfaxFailures')}</Text>
                {active.commonFailures.map((f) => (
                  <View key={f.id} style={styles.block}>
                    <Text style={styles.blockTitle}>{f.title}</Text>
                    <Text style={styles.blockBody}>
                      {f.symptoms.join(' · ')} ·{' '}
                      {tOrRaw(t, `monVehicule.sev.${f.severity}`, f.severity)}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </Card>

      {/* Minimum maintenance */}
      <Card title={t('monVehicule.maintTitle')}>
        <Text style={styles.lead}>{t('monVehicule.maintLead')}</Text>
        {remindersLabel ? <Text style={styles.hint}>{remindersLabel}</Text> : null}
        {minMaint.map((m) => (
          <View key={m.id} style={styles.maintRow}>
            <Text style={styles.maintTitle}>{m.title}</Text>
            <Text style={styles.blockBody}>
              {m.dueDateIso
                ? t('monVehicule.maintDueDate', { date: m.dueDateIso })
                : t('monVehicule.maintDueKm', { km: (m.dueKm ?? 0).toLocaleString('fr-FR') })}
              {' · '}
              {m.status === 'a_faire' ? t('monVehicule.maintTodo') : t('monVehicule.maintPlanned')}
            </Text>
          </View>
        ))}
        {active?.fluids ? (
          <View style={styles.fluids}>
            <FluidChip label={t('monVehicule.fluidOil')} value={`${active.fluids.engineOilL} L`} />
            <FluidChip label={t('monVehicule.fluidCoolant')} value={`${active.fluids.coolantL} L`} />
          </View>
        ) : null}
        <Link href="/modules/entretien" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkTxt}>{t('monVehicule.maintLink')}</Text>
          </Pressable>
        </Link>
      </Card>

      {active ? (
        <Card title={t('monVehicule.ficheTitle')}>
          <Field label={t('monVehicule.fieldLabel')} value={active.label} />
          <Field label="VIN" value={active.vin ?? '—'} />
          <Field label={t('monVehicule.fieldMake')} value={active.make} />
          <Field label={t('monVehicule.fieldModel')} value={active.model} />
          <Field label={t('monVehicule.fieldYear')} value={String(active.year)} />
          <Field
            label={t('monVehicule.fieldPower')}
            value={`${tOrRaw(t, `monVehicule.power.${active.powertrain}`, active.powertrain)} · ${tOrRaw(t, `monVehicule.class.${active.vehicleClass}`, active.vehicleClass)}`}
          />
          <Field
            label={t('monVehicule.fieldZone')}
            value={`${tOrRaw(t, `monVehicule.continent.${active.continent}`, active.continent)} / ${tOrRaw(t, `monVehicule.country.${active.country}`, active.country)} · ${active.currency}`}
          />

          <Text style={styles.section}>{t('monVehicule.odoTitle')}</Text>
          <View style={styles.row}>
            <TextInput
              value={odoDraft}
              onChangeText={setOdoDraft}
              keyboardType="number-pad"
              placeholder="km"
              placeholderTextColor={colors.muted}
              style={[styles.input, { flex: 1 }]}
              accessibilityLabel={t('monVehicule.odoTitle')}
            />
            <Pressable style={styles.secondary} onPress={saveOdometer}>
              <Text style={styles.secondaryTxt}>{t('save')}</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <Card title={t('monVehicule.noneTitle')}>
          <Text style={styles.hint}>{t('monVehicule.noneHint')}</Text>
        </Card>
      )}

      {active ? (
        <View style={styles.obdPanel}>
          <Text style={styles.obdTitle}>{t('monVehicule.obdTitle')}</Text>
          <Text style={styles.obdHint}>{t('monVehicule.obdHint')}</Text>
          <Text style={styles.obdVehicle}>
            {active.make} {active.model} · {active.year}
            {active.vin ? ` · …${active.vin.slice(-8)}` : ''}
          </Text>
          <Link
            href={{ pathname: '/modules/obd', params: { from: 'vin' } }}
            asChild
          >
            <Pressable
              style={styles.obdCta}
              accessibilityRole="button"
              accessibilityLabel={t('monVehicule.obdCtaA11y')}
            >
              <Text style={styles.obdCtaTxt}>{t('monVehicule.obdCta')}</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}


      {vehicles.length > 1 ? (
        <Card title={t('monVehicule.switchTitle')}>
          <View style={styles.chips}>
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                style={[styles.chip, active?.id === v.id && styles.chipOn]}
                onPress={() => setActive(v.id)}
              >
                <Text style={[styles.chipTxt, active?.id === v.id && styles.chipTxtOn]}>
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      <Card title={t('monVehicule.docsTitle')}>
        <Link href="/modules/entretien" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkTxt}>{t('monVehicule.linkEntretien')}</Text>
          </Pressable>
        </Link>
        <Link href="/modules/flotte" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkTxt}>{t('monVehicule.linkFlotte')}</Text>
          </Pressable>
        </Link>
        <Link href="/modules/profil-camion" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkTxt}>{t('monVehicule.linkProfil')}</Text>
          </Pressable>
        </Link>
      </Card>
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.line}>
      <Text style={styles.k}>{label} : </Text>
      {value}
    </Text>
  );
}

function FluidChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fluidChip}>
      <Text style={styles.fluidLabel}>{label}</Text>
      <Text style={styles.fluidVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: {
    color: colors.slate,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  fieldLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 4,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    lineHeight: 26,
    color: colors.ink,
    backgroundColor: colors.white,
    minHeight: 52,
  },
  row: { flexDirection: 'row', gap: 10 },
  primary: {
    flex: 1,
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryTxt: { color: colors.white, fontWeight: '800', fontSize: 16 },
  secondary: {
    flex: 1,
    backgroundColor: colors.mist,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.line,
    minHeight: 52,
  },
  secondaryTxt: { color: colors.slate, fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
  msg: { color: colors.garage, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  line: { color: colors.slate, fontSize: 15, lineHeight: 24 },
  k: { fontWeight: '800', color: colors.ink },
  section: {
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '800',
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
  },
  fluids: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  fluidChip: {
    backgroundColor: colors.garageSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: '45%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.line,
  },
  fluidLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  fluidVal: { color: colors.ink, fontWeight: '800', fontSize: 18 },
  block: {
    backgroundColor: colors.mist,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  blockTitle: { fontWeight: '800', color: colors.ink, fontSize: 15, lineHeight: 22 },
  blockBody: { color: colors.slate, fontSize: 14, lineHeight: 20 },
  maintRow: {
    backgroundColor: colors.signalSoft,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  maintTitle: { fontWeight: '800', color: colors.ink, fontSize: 17, lineHeight: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.mist,
    borderWidth: 2,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { color: colors.slate, fontSize: 14, fontWeight: '700' },
  chipTxtOn: { color: colors.white },
  linkBtn: { paddingVertical: 10 },
  linkTxt: { color: colors.signal, fontWeight: '800', fontSize: 15 },
  obdPanel: {
    backgroundColor: colors.asphalt,
    borderRadius: 14,
    padding: 18,
    gap: 10,
    borderWidth: 2,
    borderColor: colors.signal,
  },
  obdTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  obdHint: {
    color: colors.mist,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  obdVehicle: {
    color: colors.signalSoft,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  obdCta: {
    marginTop: 4,
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  obdCtaTxt: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
