import { Module, VuexModule, Mutation, Action } from "vuex-module-decorators";

import { firestore } from "@/plugins/firebase";

import { Github, InstallationStatus } from "../../../../shared/github";
import { Review } from "../../../../shared/types";
import { CountdownLatch } from "../../../../shared/asyncUtils";
import { reviewMetadatasEqual } from "../../../../shared/typeUtils";

type Listener = () => void;

const sortByTime = (a: Review, b: Review) => {
  return b.metadata.updated_at - a.metadata.updated_at;
};

@Module({
  name: "inbox"
})
export default class InboxModule extends VuexModule {
  public installation: InstallationStatus = {
    installed: false
  };
  public outgoing: Review[] = [];
  public incoming: Review[] = [];
  public listeners: Listener[] = [];

  @Action({ rawError: true })
  public async initialize(opts: { github: Github; login: string }) {
    this.context.commit("stopListening");

    const installation = await opts.github.getInstallations();
    this.context.commit("setInstallation", installation);
    if (!installation.installed) {
      return;
    }

    const latch = new CountdownLatch(2);

    // TODO: Add ordering in queries
    const outgoingUnsub = firestore()
      .collectionGroup("reviews")
      .where("metadata.author", "==", opts.login)
      .limit(20)
      .onSnapshot(snap => {
        const reviews = snap.docs.map(d => d.data() as Review);
        this.context.commit("setOutgoing", reviews);
        latch.decrement();
      });
    this.context.commit("addListener", outgoingUnsub);

    const incomingUnsub = firestore()
      .collectionGroup("reviews")
      .where("state.reviewers", "array-contains", opts.login)
      .limit(20)
      .onSnapshot(snap => {
        const reviews = snap.docs.map(d => d.data() as Review);
        this.context.commit("setIncoming", reviews);
        latch.decrement();
      });
    this.context.commit("addListener", incomingUnsub);

    return latch.wait();
  }

  @Mutation
  public addListener(listener: Listener) {
    this.listeners.push(listener);
  }

  @Mutation
  public stopListening() {
    for (const l of this.listeners) {
      l();
    }

    this.listeners = [];
  }

  @Mutation
  public setInstallation(installation: InstallationStatus) {
    this.installation = installation;
  }

  @Mutation
  public setIncoming(incoming: Review[]) {
    this.incoming = incoming;
  }

  @Mutation
  public setOutgoing(outgoing: Review[]) {
    this.outgoing = outgoing;
  }

  get outbox() {
    return this.outgoing.filter(r => !r.state.closed).sort(sortByTime);
  }

  get inbox() {
    return this.incoming.filter(r => !r.state.closed).sort(sortByTime);
  }

  get finished() {
    const combined = [...this.incoming];
    for (const r of this.outgoing) {
      if (!combined.find(x => reviewMetadatasEqual(x.metadata, r.metadata))) {
        combined.push(r);
      }
    }

    return combined.filter(r => r.state.closed).sort(sortByTime);
  }
}
