import Vue from "vue";
import { Module, VuexModule, Mutation, Action } from "vuex-module-decorators";
import * as uuid from "uuid";
import {
  Comment,
  CommentUser,
  Thread,
  ThreadPositionArgs,
  threadMatch,
  Review,
  ReviewMetadata,
  ThreadContentArgs,
  ThreadArgs
} from "@/model/review";
import * as events from "../../plugins/events";
import { NEW_COMMENT_EVENT, AddCommentEvent } from "../../plugins/events";
import { firestore } from "../../plugins/firebase";

interface ReviewState {
  base: string;
  head: string;
}

// TODO: Namespacing?
@Module({
  name: "review"
})
export default class ReviewModule extends VuexModule {
  // UI State related to the review (not persisted)
  public reviewState: ReviewState = {
    base: "unknown",
    head: "unknown"
  };

  // The review itself
  public review: Review = {
    metadata: {
      owner: "unknown",
      repo: "unknown",
      number: 0,
      base: {
        sha: "unknown",
        label: "unknown:unknown"
      },
      head: {
        sha: "unknown",
        label: "unknown:unknown"
      }
    },
    reviewers: {},
    threads: [],
    comments: []
  };

  static reviewKey(metadata: ReviewMetadata) {
    const { owner, repo, number } = metadata;
    return `${owner}-${repo}-${number}`;
  }

  static reviewRef(metadata: ReviewMetadata) {
    return firestore()
      .collection("reviews")
      .doc(this.reviewKey(metadata));
  }

  static threadsRef(metadata: ReviewMetadata) {
    return this.reviewRef(metadata).collection("threads");
  }

  static commentsRef(metadata: ReviewMetadata) {
    return this.reviewRef(metadata).collection("comments");
  }

  get drafts() {
    return this.review.comments.filter(x => x.draft);
  }

  get commentsByThread() {
    return (threadId: string) => {
      return this.review.comments.filter(x => x.threadId === threadId);
    };
  }

  get threadById() {
    return (threadId: string) => {
      return this.review.threads.find(x => x.id === threadId) || null;
    };
  }

  get threadByArgs() {
    return (args: ThreadPositionArgs | null) => {
      if (args === null) {
        return null;
      }
      return this.review.threads.find(t => threadMatch(t, args)) || null;
    };
  }

  get threadsByFileAndSha() {
    return (file: string, sha: string) => {
      return this.review.threads.filter(
        x => x.currentArgs.file === file && x.currentArgs.sha === sha
      );
    };
  }

  @Action
  public async initializeReview(metadata: ReviewMetadata) {
    this.context.commit("setReview", {
      metadata,
      reviewers: {},
      threads: [],
      comments: []
    });

    this.context.commit("setReviewState", {
      base: metadata.base.sha,
      head: metadata.head.sha
    });

    // TODO: Unsub
    ReviewModule.threadsRef(metadata).onSnapshot(snap => {
      console.log("threads#onSnapshot", snap.size);
      const threads = snap.docs.map(doc => doc.data() as Thread);
      this.context.commit("setThreads", threads);
    });

    // TODO: Unsub
    ReviewModule.commentsRef(metadata).onSnapshot(snap => {
      console.log("comments#onSnapshot", snap.size);
      const comments = snap.docs.map(doc => doc.data() as Comment);
      this.context.commit("setComments", comments);

      // TODO: We should actually sync this with the array instead
      // TODO: Should we watch all events? This feels messy.
      snap.docChanges().forEach(chg => {
        if (chg.type === "added") {
          const comment = chg.doc.data() as Comment;
          events.emit(NEW_COMMENT_EVENT, { threadId: comment.threadId });
        }
      });
    });

    // TODO: need a teardown method too
  }

  @Mutation
  public setReview(review: Review) {
    this.review = review;
  }

  @Mutation
  public setReviewState(reviewState: ReviewState) {
    this.reviewState = reviewState;
  }

  @Mutation
  public setThreads(threads: Thread[]) {
    Vue.set(this.review, "threads", threads);
  }

  @Mutation
  public setComments(comments: Comment[]) {
    Vue.set(this.review, "comments", comments);
  }

  @Mutation
  public setThreadPendingState(opts: { threadId: string; resolved: boolean }) {
    const thread = this.review.threads.find(x => x.id === opts.threadId);
    if (thread) {
      thread.pendingResolved = opts.resolved;
    }
  }

  @Mutation
  public pushReviewer(opts: { login: string; approved: boolean }) {
    // Makes the new map key reactive
    Vue.set(this.review.reviewers, opts.login, opts.approved);
  }

  @Mutation
  public removeReviewer(opts: { login: string }) {
    // Makes the removed map key reactive
    Vue.delete(this.review.reviewers, opts.login);
  }

  @Mutation
  public setBaseAndHead(opts: { base: string; head: string }) {
    console.log(`review#setBaseAndHead(${opts.base}, ${opts.head})`);
    this.reviewState.base = opts.base;
    this.reviewState.head = opts.head;
  }

  @Action
  public async newThread(opts: {
    args: ThreadPositionArgs;
    ca: ThreadContentArgs;
  }): Promise<Thread> {
    console.log(`newThread(${JSON.stringify(opts)})`);

    // TODO: Do something about this
    const prHead = this.review.metadata.head.sha;
    if (opts.args.sha !== prHead) {
      console.log(
        `newThread: thread posted on outdated commit (head=${prHead})`
      );
    }

    const ta: ThreadArgs = { ...opts.args, ...opts.ca };
    const thread: Thread = {
      id: uuid.v4(),
      resolved: false,
      pendingResolved: false,
      draft: true,

      // TODO: Is this right? Should they differ?
      currentArgs: ta,
      originalArgs: ta
    };

    // Push the thread to Firebase
    await ReviewModule.threadsRef(this.review.metadata)
      .doc(thread.id)
      .set(thread);

    return thread;
  }

  @Action
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

    // Push the comment to Firebase
    await ReviewModule.commentsRef(this.review.metadata)
      .doc(comment.id)
      .set(comment);

    return comment;
  }

  @Action
  public async sendDraftComments() {
    // TODO: Only update MY drafts!
    const batch = firestore().batch();

    for (const thread of this.review.threads) {
      batch.update(
        ReviewModule.threadsRef(this.review.metadata).doc(thread.id),
        {
          draft: false,
          resolved: thread.pendingResolved
        }
      );
    }

    for (const comment of this.review.comments) {
      batch.update(
        ReviewModule.commentsRef(this.review.metadata).doc(comment.id),
        {
          draft: false
        }
      );
    }

    await batch.commit();
  }

  @Action
  public async handleAddCommentEvent(opts: {
    e: AddCommentEvent;
    user: CommentUser;
  }) {
    const e = opts.e;
    const threadArgs: ThreadPositionArgs = {
      file: e.file,
      sha: e.sha,
      line: e.line
    };

    const threadContentArgs: ThreadContentArgs = {
      lineContent: e.lineContent
    };

    // TODO: Doing this inside the comment thread may help reactivity?
    let thread: Thread | null = this.threadByArgs(threadArgs);
    if (!thread) {
      thread = await this.newThread({
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
  }
}
