/** Typed Firebase / mock service facade for all 17 modules. */
export * from './result';
export * from './authService';
export * from './vehiclesService';
export * from './partsService';
export * from './obdService';
export * from './garagesService';
export * from './medicalService';
export * from './hazardsService';
export * from './gpsService';
export * from './weighService';
export * from './quotesService';
export * from './insuranceService';
export * from './appointmentsService';
export * from './youtubeService';
export * from './feedService';
export * from './learnedFailuresService';

export { firebaseStatusLabel, isFirebaseConfigured, getFirebase } from '../../firebase/config';
