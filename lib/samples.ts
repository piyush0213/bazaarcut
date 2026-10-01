export const SAMPLES = [
  {
    id: "brass-diya",
    label: "Brass diya",
    file: "brass-diya.jpg",
  },
  {
    id: "cotton-kurta",
    label: "Cotton kurta",
    file: "cotton-kurta.jpg",
  },
  {
    id: "clay-mug",
    label: "Clay mug",
    file: "clay-mug.jpg",
  },
  {
    id: "spice-jar",
    label: "Spice jar",
    file: "spice-jar.jpg",
  },
  {
    id: "jute-bag",
    label: "Jute bag",
    file: "jute-bag.jpg",
  },
] as const;

export type SampleId = (typeof SAMPLES)[number]["id"];

export function findSample(id: string) {
  return SAMPLES.find((sample) => sample.id === id) ?? null;
}
