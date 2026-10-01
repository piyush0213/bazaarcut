export type DeliveryKey = "catalog" | "square" | "story";

export type Delivery = {
  key: DeliveryKey;
  title: string;
  detail: string;
  url: string;
  downloadUrl: string;
};

export type SourceAsset = {
  label: string;
  previewUrl: string;
  publicId: string;
  cloudName: string;
  assetId: string | null;
  secureUrl: string | null;
  usedDemoCloud: boolean;
  note: string;
  deliveries: Delivery[];
};

export type ModelPreference = "quality_fast" | "economy_fast";

export type Variant = {
  preference: ModelPreference;
  modelId: string | null;
  family: string | null;
  tier: string | null;
  publicId: string | null;
  secureUrl: string | null;
  deliveries: Delivery[];
  error: string | null;
};
