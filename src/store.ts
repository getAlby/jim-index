// Import the package
import NDK, {
  NDKEvent,
  NDKKind,
  NDKNip07Signer,
  NDKSigner,
  NDKUser,
} from "@nostr-dev-kit/ndk";
import { create } from "zustand";
import { JIM_INSTANCE_KIND } from "./types";

// disable Alby getRelays
if (window.nostr) {
  window.nostr.getRelays = undefined;
}

// TODO: do not create signer on startup as it launches dialog
// Create a new NDK instance with explicit relays
export const ndk = new NDK({
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
});

type Jim = {
  url: string;
  eventId: string;
  event: NDKEvent;
  recommendedByUsers: { user: NDKUser; mutual: boolean }[];
  info: {
    name?: string;
    description?: string;
    image?: string;
  };
  reserves: {
    numChannels: number;
    totalOutgoingCapacity: number;
    totalChannelCapacity: number;
    numApps: number;
    totalAppBalance: number;
    hasPublicChannels: boolean;
  };
};

type Store = {
  readonly jims: Jim[];
  readonly isLoggedIn: boolean;
  readonly hasLoaded: boolean;
  setJims(jims: Jim[]): void;
  setLoaded(hasLoaded: boolean): void;
  login(): Promise<boolean>;
};

export const useStore = create<Store>((set, get) => ({
  isLoggedIn: false,
  jims: [],
  hasLoaded: false,
  setJims: (jims) => set({ jims }),
  setLoaded: (hasLoaded) => set({ hasLoaded }),
  login: async () => {
    if (get().isLoggedIn || !get().hasLoaded) {
      return get().isLoggedIn;
    }
    set({ hasLoaded: false });
    const signer = new NDKNip07Signer();
    ndk.signer = signer;
    await loadJims();
    await loadMutualRecommendations(signer);
    set({
      isLoggedIn: true,
      hasLoaded: true,
    });
    return true;
  },
}));

(async () => {
  await ndk.connect();
  await loadJims();
  useStore.getState().setLoaded(true);
})();

async function loadJims() {
  const jimInstanceEvents = await ndk.fetchEvents({
    kinds: [JIM_INSTANCE_KIND as NDKKind],
  });

  const jims: Jim[] = [];
  console.log("jim instance events", jimInstanceEvents);
  for (const event of jimInstanceEvents) {
    const url = event.dTag;
    if (url && !url.endsWith("/")) {
      let info: Jim["info"];
      try {
        const response = await fetch(new URL("/api/info", url));
        if (!response.ok) {
          throw new Error("non-ok response");
        }
        info = await response.json();
      } catch (error) {
        console.error("failed to fetch jim info", url, error);
        continue;
      }
      let reserves: Jim["reserves"];
      try {
        const response = await fetch(new URL("/api/reserves", url));
        if (!response.ok) {
          throw new Error("non-ok response");
        }
        reserves = await response.json();
      } catch (error) {
        console.error("failed to fetch jim reserves", url, error);
        continue;
      }

      jims.push({
        eventId: event.id,
        url,
        recommendedByUsers: [],
        event,
        info,
        reserves,
      });
      useStore.getState().setJims(jims);
    }
  }

  // load recommendations

  const jimRecommendationEvents = await ndk.fetchEvents({
    kinds: [38000],
    "#k": [JIM_INSTANCE_KIND.toString()],
  });

  console.log("jim recommendation events", jimRecommendationEvents);
  for (const recommendationEvent of jimRecommendationEvents) {
    const jim = jims.find((j) => j.eventId === recommendationEvent.dTag);
    if (jim) {
      jim.recommendedByUsers.push({
        user: recommendationEvent.author,
        mutual: false,
      });
    }
  }
  useStore.getState().setJims(jims);
}

async function loadMutualRecommendations(signer: NDKSigner) {
  console.log("fetching user...");
  const user = await signer.user();
  console.log("user", user);
  const follows = await user.follows();
  console.log("follows", follows);
  const followsPubkeys = [...Array.from(follows), user].map(
    (follow) => follow.pubkey,
  );
  const jims = useStore.getState().jims;
  for (const jim of jims) {
    for (const recommendedByUser of jim.recommendedByUsers) {
      if (followsPubkeys.includes(recommendedByUser.user.pubkey)) {
        recommendedByUser.mutual = true;
        await recommendedByUser.user.fetchProfile();
      }
    }
  }
  useStore.getState().setJims(jims);

  // TODO: sort jims

  useStore.getState().setLoaded(true);
}
