/**
 * US states served by Ella Tax Services, used by the nationwide states marquee.
 * `code` is the lowercase two-letter postal code and also the flag filename:
 * `/assets/state-flags/us-{code}.png`.
 */
export interface UsState {
  name: string;
  code: string;
}

export const usStates: readonly UsState[] = [
  { name: "Alabama", code: "al" },
  { name: "Alaska", code: "ak" },
  { name: "Arizona", code: "az" },
  { name: "Arkansas", code: "ar" },
  { name: "California", code: "ca" },
  { name: "Colorado", code: "co" },
  { name: "Connecticut", code: "ct" },
  { name: "Delaware", code: "de" },
  { name: "Florida", code: "fl" },
  { name: "Georgia", code: "ga" },
  { name: "Hawaii", code: "hi" },
  { name: "Idaho", code: "id" },
  { name: "Illinois", code: "il" },
  { name: "Indiana", code: "in" },
  { name: "Iowa", code: "ia" },
  { name: "Kansas", code: "ks" },
  { name: "Kentucky", code: "ky" },
  { name: "Louisiana", code: "la" },
  { name: "Maine", code: "me" },
  { name: "Maryland", code: "md" },
  { name: "Massachusetts", code: "ma" },
  { name: "Michigan", code: "mi" },
  { name: "Minnesota", code: "mn" },
  { name: "Mississippi", code: "ms" },
  { name: "Missouri", code: "mo" },
  { name: "Montana", code: "mt" },
  { name: "Nebraska", code: "ne" },
  { name: "Nevada", code: "nv" },
  { name: "New Hampshire", code: "nh" },
  { name: "New Jersey", code: "nj" },
  { name: "New Mexico", code: "nm" },
  { name: "New York", code: "ny" },
  { name: "North Carolina", code: "nc" },
  { name: "North Dakota", code: "nd" },
  { name: "Ohio", code: "oh" },
  { name: "Oklahoma", code: "ok" },
  { name: "Oregon", code: "or" },
  { name: "Pennsylvania", code: "pa" },
  { name: "Rhode Island", code: "ri" },
  { name: "South Carolina", code: "sc" },
  { name: "South Dakota", code: "sd" },
  { name: "Tennessee", code: "tn" },
  { name: "Texas", code: "tx" },
  { name: "Utah", code: "ut" },
  { name: "Vermont", code: "vt" },
  { name: "Virginia", code: "va" },
  { name: "Washington", code: "wa" },
  { name: "West Virginia", code: "wv" },
  { name: "Wisconsin", code: "wi" },
  { name: "Wyoming", code: "wy" },
];
