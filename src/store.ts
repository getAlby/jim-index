// Import the package
import NDK, { NDKKind, NDKNip07Signer, NDKUser } from "@nostr-dev-kit/ndk";
import { create } from "zustand";
import { JIM_INSTANCE_KIND } from "./types";

// disable Alby getRelays
if (window.nostr) {
  window.nostr.getRelays = undefined;
}

// TODO: do not create signer on startup as it launches dialog
// Create a new NDK instance with explicit relays
const signer = new NDKNip07Signer();
const ndk = new NDK({
  // TODO: review relays
  explicitRelayUrls: [
    "wss://relay.damus.io",
    "wss://eden.nostr.land",
    "wss://nos.lol",
    "wss://nostr.wine",
    "wss://relay.notoshi.win",
    "wss://lunchbox.sandwich.farm",
    "wss://nostr.stakey.net",
    "wss://relay.n057r.club",
  ],
  signer,
});

type Jim = {
  url: string;
  eventId: string;
  recommendedByUsers: { user: NDKUser; mutual: boolean }[];
};

type Store = {
  readonly ndk: NDK;
  readonly jims: Jim[];
  readonly hasLoaded: boolean;
  setJims(jims: Jim[]): void;
  setLoaded(hasLoaded: boolean): void;
};

export const useStore = create<Store>((set) => ({
  ndk,
  jims: [],
  hasLoaded: false,
  setJims: (jims) => set({ jims }),
  setLoaded: (hasLoaded) => set({ hasLoaded }),
}));

(async () => {
  await ndk.connect();

  const jimInstanceEvents = await ndk.fetchEvents({
    kinds: [JIM_INSTANCE_KIND as NDKKind],
  });

  const jims: Jim[] = [];
  console.log("jim instance events", jimInstanceEvents);
  for (const event of jimInstanceEvents) {
    const url = event.dTag;
    if (url && !url.endsWith("/")) {
      jims.push({
        eventId: event.id,
        url,
        recommendedByUsers: [],
      });
    }
  }
  useStore.getState().setJims(jims);

  // load recommendations

  const jimRecommendationEvents = await ndk.fetchEvents({
    kinds: [38000],
    "#k": [JIM_INSTANCE_KIND.toString()],
  });

  console.log("jim recommendation events", jimRecommendationEvents);
  for (const recommendationEvent of jimRecommendationEvents) {
    const jim = jims.find((j) => j.eventId === recommendationEvent.dTag);
    if (jim) {
      // TODO: save pubkeys
      jim.recommendedByUsers.push({
        user: recommendationEvent.author,
        mutual: false,
      });
    }
  }
  useStore.getState().setJims(jims);

  // mutual recommendations

  console.log("fetching user...");
  const user = await signer.user();
  console.log("user", user);
  const follows = await user.follows();
  console.log("follows", follows);
  const followsPubkeys = [...Array.from(follows), user].map(
    (follow) => follow.pubkey,
  );
  for (const jim of jims) {
    for (const recommendedByUser of jim.recommendedByUsers) {
      if (followsPubkeys.includes(recommendedByUser.user.pubkey)) {
        recommendedByUser.mutual = true;
      }
    }
  }
  useStore.getState().setJims(jims);

  // TODO: sort jims

  useStore.getState().setLoaded(true);
})();
