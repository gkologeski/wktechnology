// Current RPC DTOs. The unused prototype types were superseded by migration 0321.
export type { LifecycleContext } from "./lifecycle.functions";
import type { LifecycleChange, LifecycleSnapshot } from "./lifecycle.functions";
export type LifecycleKind = LifecycleChange["kind"];
export type LifecycleInput = LifecycleChange;
export type LifecyclePreview = LifecycleSnapshot;
