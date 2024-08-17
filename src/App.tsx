import { NDKEvent } from "@nostr-dev-kit/ndk";
import jimLogo from "./assets/jim.svg";
import { useStore } from "./store";
import { JIM_INSTANCE_KIND } from "./types";

export default function App() {
  const store = useStore();

  async function addJim() {
    const promptResponse = prompt("Enter your Jim URL");
    if (!promptResponse) {
      return;
    }
    let jimUrl: string;
    try {
      const url = new URL(promptResponse);
      jimUrl = url.toString();
      if (jimUrl.endsWith("/")) {
        jimUrl = jimUrl.substring(0, jimUrl.length - 1);
      }
      if (!confirm("Confirm publish new Jim: " + url)) {
        return;
      }
    } catch (error) {
      alert("Invalid URL: " + error);
      return;
    }
    const event = new NDKEvent(store.ndk);
    event.kind = JIM_INSTANCE_KIND;
    event.dTag = jimUrl.toString();

    try {
      const publishedRelays = await event.publish(undefined, undefined, 1);

      alert(
        "Published to " +
          Array.from(publishedRelays)
            .map((relay) => relay.url)
            .join(", "),
      );
    } catch (error) {
      alert("Publish failed: " + error);
    }
  }

  async function recommend(eventId: string) {
    const event = new NDKEvent(store.ndk);
    event.kind = 38000;
    event.tags.push(["k", JIM_INSTANCE_KIND.toString()]);
    event.dTag = eventId;
    try {
      if (!confirm("Confirm publish recommendation for event " + eventId)) {
        return;
      }
      const publishedRelays = await event.publish(undefined, undefined, 1);
      alert(
        "Published to " +
          Array.from(publishedRelays)
            .map((relay) => relay.url)
            .join(", "),
      );
    } catch (error) {
      alert("Publish failed: " + error);
    }
  }

  return (
    <div className="">
      <div className="flex justify-between items-center p-4">
        <div className="flex items-center gap-2">
          <img src={jimLogo} className="w-6 h-6" />
          Jim Index
        </div>
        <div className="flex items-center justify-end gap-2">
          {!store.hasLoaded && (
            <span className="loading loading-spinner loading-md"></span>
          )}
          <button onClick={addJim} className="btn btn-primary">
            Add Jim
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {store.jims.map((jim) => (
          <div key={jim.url} className="card bg-base-100 w-96 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">
                <a
                  href={jim.url}
                  target="_blank"
                  className="w-full link font-semibold"
                >
                  {jim.url}
                </a>
              </h2>
              <p className="text-sm">
                {jim.recommendedByUsers.length} recommendations (
                {jim.recommendedByUsers.filter((r) => r.mutual).length} mutual)
              </p>
              <div className="card-actions justify-end mt-2">
                <button
                  onClick={() => recommend(jim.eventId)}
                  className="btn btn-primary btn-sm"
                >
                  Recommend
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
