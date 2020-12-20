import { Module, VuexModule, Mutation, Action } from "vuex-module-decorators";
import * as uuid from "uuid";
import { threadMatch } from "@/model/review";
import {
  Comment,
  CommentUser,
  Thread,
  Review,
  ReviewMetadata,
  ThreadContentArgs,
  ThreadArgs,
  ThreadPositionArgs,
  ReviewStatus,
  ReviewState,
  ReviewIdentifier
} from "../../../../shared/types";
import {
  addReviewer,
  removeReviewer,
  addApprover,
  removeApprover,
  calculateReviewStatus
} from "../../../../shared/typeUtils";
import * as events from "../../plugins/events";
import firebase from "firebase/app";
import { firestore } from "../../plugins/firebase";
import {
  repoPath,
  reviewPath,
  threadsPath,
  commentsPath
} from "../../../../shared/database";
import { CountdownLatch } from "../../../../shared/asyncUtils";

type Listener = () => void;

interface ViewState {
  base: string;
  head: string;
}

const SortByTimestamp = function(a: Comment, b: Comment) {
  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
};

@Module({
  name: "review"
})
export default class ReviewModule extends VuexModule {
  // UI State related to the review (not persisted)
  public viewState: ViewState = {
    // What the user is viewing (not the actual base and head)
    base: "unknown",
    head: "unknown"
  };

  // Threads and comments which are attached to the review
  public threads: Thread[] = [];
  public comments: Comment[] = [];

  // Local estimate of review state
  public estimatedState = {
    status: ReviewStatus.NEEDS_REVIEW,
    unresolved: 0
  };

  // The review itself
  public review: Review = {
    metadata: {
      owner: "unknown",
      repo: "unknown",
      number: 0,
      author: "unknown",
      title: "unknown",
      base: {
        sha: "unknown",
        label: "unknown:unknown"
      },
      head: {
        sha: "unknown",
        label: "unknown:unknown"
      },
      updated_at: new Date().getTime()
    },
    state: {
      status: ReviewStatus.NEEDS_REVIEW,
      closed: false,
      reviewers: [],
      approvers: [],
      unresolved: 0
    }
  };

  public listeners: { [key: string]: Listener | null } = {
    review: null,
    comments: null,
    threads: null
  };

  static forceConverter<T>(): firebase.firestore.FirestoreDataConverter<T> {
    return {
      toFirestore: (modelObject: T) => {
        return modelObject;
      },
      fromFirestore: (snapshot, options) => {
        return snapshot.data() as T;
      }
    };
  }

  static repoRef(opts: ReviewIdentifier) {
    return firestore().doc(repoPath(opts));
  }

  static reviewRef(opts: ReviewIdentifier) {
    return firestore()
      .doc(reviewPath(opts))
      .withConverter(this.forceConverter<Review>());
  }

  static threadsRef(opts: ReviewIdentifier) {
    return firestore()
      .collection(threadsPath(opts))
      .withConverter(this.forceConverter<Thread>());
  }

  static commentsRef(opts: ReviewIdentifier) {
    return firestore()
      .collection(commentsPath(opts))
      .withConverter(this.forceConverter<Comment>());
  }

  get drafts() {
    return this.comments.filter(x => x.draft);
  }

  get commentsByThread() {
    return (threadId: string) => {
      return this.comments
        .filter(x => x.threadId === threadId)
        .sort(SortByTimestamp);
    };
  }

  get threadById() {
    return (threadId: string) => {
      return this.threads.find(x => x.id === threadId) || null;
    };
  }

  get threadByArgs() {
    return (args: ThreadPositionArgs | null) => {
      if (args === null) {
        return null;
      }
      return this.threads.find(t => threadMatch(t, args)) || null;
    };
  }

  get threadsByFileAndSha() {
    return (file: string, sha: string) => {
      return this.threads.filter(
        x => x.currentArgs.file === file && x.currentArgs.sha === sha
      );
    };
  }

  @Action({ rawError: true })
  public async initializeReview(opts: ReviewIdentifier) {
    this.context.commit("stopListening");

    const latch = new CountdownLatch(3);

    const reviewUnsub = ReviewModule.reviewRef(opts).onSnapshot(
      { includeMetadataChanges: true },
      snap => {
        console.log(
          `review#onSnapshot: pending=${snap.metadata.hasPendingWrites}`
        );
        const review = snap.data();

        if (review) {
          this.context.commit("setReviewMetadata", review.metadata);
          this.context.commit("setViewState", {
            base: review.metadata.base.sha,
            head: review.metadata.head.sha
          });

          // For the review state we actually prefer our guesses
          if (!snap.metadata.hasPendingWrites) {
            this.context.commit("setReviewState", review.state);
            this.context.commit("calculateReviewStatus");
          }
        }

        latch.decrement();
      }
    );

    const threadsUnsub = ReviewModule.threadsRef(opts).onSnapshot(snap => {
      console.log("threads#onSnapshot", snap.size);
      const threads = snap.docs.map(doc => doc.data());
      this.context.commit("setThreads", threads);

      snap.docChanges().forEach(chg => {
        const thread = chg.doc.data();
        events.emit(events.NEW_THREAD_EVENT, { threadId: thread.id });
      });

      latch.decrement();
    });

    const commentsUnsub = ReviewModule.commentsRef(opts).onSnapshot(snap => {
      console.log("comments#onSnapshot", snap.size);
      const comments = snap.docs.map(doc => doc.data() as Comment);
      this.context.commit("setComments", comments);

      snap.docChanges().forEach(chg => {
        const comment = chg.doc.data() as Comment;
        events.emit(events.NEW_COMMENT_EVENT, { threadId: comment.threadId });
      });

      latch.decrement();
    });

    this.context.commit("setListeners", {
      review: reviewUnsub,
      comments: commentsUnsub,
      threads: threadsUnsub
    });

    return latch.wait();
  }

  @Mutation
  public setListeners(opts: {
    review: Listener | null;
    comments: Listener | null;
    threads: Listener | null;
  }) {
    this.listeners.review = opts.review;
    this.listeners.comments = opts.comments;
    this.listeners.threads = opts.threads;
  }

  @Mutation
  public stopListening() {
    for (const key of Object.keys(this.listeners)) {
      const listener = this.listeners[key];
      if (listener) {
        listener();
      }
      this.listeners[key] = null;
    }
  }

  @Mutation
  public setReviewMetadata(metadata: ReviewMetadata) {
    this.review.metadata = metadata;
  }

  @Mutation
  public setReviewState(state: ReviewState) {
    this.review.state = state;
  }

  @Mutation
  public calculateReviewStatus() {
    if (this.review.state.closed) {
      this.estimatedState.status = this.review.state.status;
      return;
    }

    // Estimate unresolved count based on local
    this.estimatedState.unresolved = this.threads.filter(t => {
      return !t.draft && !t.resolved;
    }).length;

    const newState = {
      ...this.review.state,
      unresolved: this.estimatedState.unresolved
    };

    // Estimate review status
    this.estimatedState.status = calculateReviewStatus(newState);
    if (this.estimatedState.status !== this.review.state.status) {
      console.log(
        `calculateReviewStatus: ${this.review.state.status} --> ${this.estimatedState.status}`
      );
    }
  }

  @Mutation
  public setViewState(viewState: ViewState) {
    this.viewState = viewState;
  }

  @Mutation
  public setThreads(threads: Thread[]) {
    this.threads = threads;
  }

  @Mutation
  public setComments(comments: Comment[]) {
    this.comments = comments;
  }

  @Mutation
  public setThreadPendingState(opts: { threadId: string; resolved: boolean }) {
    const thread = this.threads.find(x => x.id === opts.threadId);
    if (thread) {
      thread.pendingResolved = opts.resolved;
    }
  }

  @Action({ rawError: true })
  public pushReviewer(opts: { login: string; approved?: boolean }) {
    this.context.commit("setReviewer", opts);

    // Estimate local state
    this.context.commit("calculateReviewStatus");

    return ReviewModule.reviewRef(this.review.metadata).update(
      "state",
      this.review.state
    );
  }

  @Mutation
  public setReviewer(opts: { login: string; approved?: boolean }) {
    // TODO: Can this whole method just react to Firestore instead?
    //       Can we use Firestore array operations?

    if (opts.approved !== undefined) {
      addReviewer(this.review, opts.login);
    } else {
      removeReviewer(this.review, opts.login);
    }

    if (opts.approved === true) {
      addApprover(this.review, opts.login);
    } else {
      removeApprover(this.review, opts.login);
    }
  }

  @Mutation
  public setBaseAndHead(opts: { base: string; head: string }) {
    console.log(`review#setBaseAndHead(${opts.base}, ${opts.head})`);
    this.viewState.base = opts.base;
    this.viewState.head = opts.head;
  }

  @Action({ rawError: true })
  public async newThread(opts: {
    username: string;
    args: ThreadPositionArgs;
    ca: ThreadContentArgs;
  }): Promise<Thread> {
    console.log(`newThread(${JSON.stringify(opts)})`);

    const prHead = this.review.metadata.head.sha;
    if (opts.args.sha !== prHead) {
      console.log(
        `newThread: thread posted on outdated commit (head=${prHead})`
      );
    }

    const ta: ThreadArgs = { ...opts.args, ...opts.ca };
    const thread: Thread = {
      id: uuid.v4(),
      username: opts.username,
      resolved: false,
      pendingResolved: false,
      draft: true,
      currentArgs: ta,
      originalArgs: ta
    };

    // Estimate local state
    this.context.commit("calculateReviewStatus");

    // Push the thread to Firebase
    await ReviewModule.threadsRef(this.review.metadata)
      .doc(thread.id)
      .set(thread);

    return thread;
  }

  @Action({ rawError: true })
  public async newComment(opts: {
    threadId: string;
    user: CommentUser;
    text: string;
  }): Promise<Comment> {
    console.log(`newComment(${JSON.stringify(opts)})`);
    const comment: Comment = {
      id: uuid.v4(),
      threadId: opts.threadId,
      username: opts.user.username,
      photoURL: opts.user.photoURL,
      text: opts.text,

      timestamp: new Date().toISOString(),
      draft: true
    };

    // Estimate local state
    this.context.commit("calculateReviewStatus");

    // Push the comment to Firebase
    await ReviewModule.commentsRef(this.review.metadata)
      .doc(comment.id)
      .set(comment);

    return comment;
  }

  @Action({ rawError: true })
  public async discardDraftComments(opts: { username: string }) {
    const batch = firestore().batch();

    const draftThreads = this.threads
      .filter(t => t.draft)
      .filter(t => t.username === opts.username);

    for (const thread of draftThreads) {
      batch.delete(
        ReviewModule.threadsRef(this.review.metadata).doc(thread.id)
      );
    }

    const draftComments = this.comments
      .filter(c => c.draft)
      .filter(c => c.username === opts.username);

    for (const comment of draftComments) {
      batch.delete(
        ReviewModule.commentsRef(this.review.metadata).doc(comment.id)
      );
    }

    await batch.commit();
  }

  @Action({ rawError: true })
  public async sendDraftComments(opts: { username: string }) {
    const batch = firestore().batch();

    // Find all threads that are drafts which we started
    const draftThreads = this.threads
      .filter(t => t.draft)
      .filter(t => t.username === opts.username);

    for (const thread of draftThreads) {
      batch.update(
        ReviewModule.threadsRef(this.review.metadata).doc(thread.id),
        {
          draft: false
        }
      );
    }

    // Find all threads which are pending resolution and update them
    // TODO: Is this safe? Is there any way we ever clobber someone else here?
    const pendingResolutionThreads = this.threads
      .filter(t => t.pendingResolved)
      .filter(t => !t.resolved);

    for (const thread of pendingResolutionThreads) {
      batch.update(
        ReviewModule.threadsRef(this.review.metadata).doc(thread.id),
        {
          resolved: true,
          pendingResolved: false
        }
      );
    }

    // Find all comments that are drafts which we wrote
    const draftComments = this.comments
      .filter(c => c.draft)
      .filter(t => t.username === opts.username);

    for (const comment of draftComments) {
      batch.update(
        ReviewModule.commentsRef(this.review.metadata).doc(comment.id),
        {
          draft: false
        }
      );
    }

    // Estimate local state
    this.context.commit("calculateReviewStatus");

    await batch.commit();
  }

  @Action({ rawError: true })
  public async handleAddCommentEvent(opts: {
    e: events.AddCommentEvent;
    user: CommentUser;
  }) {
    console.log(`review#handleAddCommentEvent(${JSON.stringify(opts)})`);

    const e = opts.e;
    const threadArgs: ThreadPositionArgs = {
      file: e.file,
      sha: e.sha,
      line: e.line
    };

    const threadContentArgs: ThreadContentArgs = {
      lineContent: e.lineContent
    };

    let thread: Thread | null = this.threadByArgs(threadArgs);
    if (!thread) {
      thread = await this.newThread({
        username: opts.user.username,
        args: threadArgs,
        ca: threadContentArgs
      });
    }

    // Add comment
    await this.newComment({
      threadId: thread.id,
      user: opts.user,
      text: e.content
    });

    // If resolution state specified, set that
    if (e.resolve != undefined) {
      this.context.commit("setThreadPendingState", {
        threadId: thread.id,
        resolved: e.resolve
      });
    }

    // TODO: At this point the resolution state of the review may have changed!
  }
}
