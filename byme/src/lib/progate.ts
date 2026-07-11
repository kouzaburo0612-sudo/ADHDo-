/**
 * ProGate: 課金ゲートの抽象化。
 * Phase 3 で RevenueCat を導入するまでは全機能を開放する。
 * 課金判定が必要な箇所は必ずこのモジュールを経由すること。
 */

export type ProFeature = 'unlimited_affirmations' | 'ai_convert' | 'voice' | 'widget';

/** 無料プランの宣言文上限(Phase 3 で有効化) */
export const FREE_AFFIRMATION_LIMIT = 3;

export function isPro(): boolean {
  // Phase 3: RevenueCat の entitlement を参照する
  return true;
}

export function canUseFeature(_feature: ProFeature): boolean {
  return isPro();
}

/** 宣言文をあと1件追加できるか */
export function canAddAffirmation(currentCount: number): boolean {
  if (isPro()) return true;
  return currentCount < FREE_AFFIRMATION_LIMIT;
}
