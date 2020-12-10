<template>
  <router-link
    :to="
      `/pr/${item.metadata.owner}/${item.metadata.repo}/${item.metadata.number}`
    "
  >
    <!-- TODO: Some of these classes should be outside -->
    <div
      class="flex items-center bg-dark-3 px-4 py-2 mb-4 border-dark-0 shadow dark-shadow rounded"
    >
      <!-- TODO: Could use JS to keep these columns the same width dynamically instead of w-1/3 -->
      <span
        :class="statusTextColor(item.state.status)"
        class="w-1/3 text-lg font-bold mr-4"
      >
        <font-awesome-icon :icon="statusIcon(item.state.status)" class="mr-2" />
        <span class="text-lg">{{ itemText(item) }}</span>
      </span>
      <span class="text-lg mr-2">{{ item.metadata.title }}</span>
      <span class="flex-grow"><!-- spacer --></span>
      <span class="text-md">
        {{ renderTime(new Date(item.metadata.updated_at)) }}
        <font-awesome-icon icon="history" class="ml-1" />
      </span>
    </div>
  </router-link>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { Review, ReviewStatus } from "../../../../shared/types";
import { itemSlug } from "../../model/inbox";

@Component({
  components: {}
})
export default class InboxItem extends Vue {
  @Prop() public item!: Review;

  async mounted() {}

  public itemText(item: Review) {
    return itemSlug(item);
  }

  public statusTextColor(status: ReviewStatus) {
    switch (status) {
      case ReviewStatus.APPROVED:
        return "text-green-400";
      case ReviewStatus.NEEDS_RESOLUTION:
      case ReviewStatus.NEEDS_APPROVAL:
      case ReviewStatus.NEEDS_REVIEW:
        return "text-yellow-400";
    }
  }

  public statusIcon(status: ReviewStatus) {
    switch (status) {
      case ReviewStatus.APPROVED:
        return "check";
      case ReviewStatus.NEEDS_RESOLUTION:
      case ReviewStatus.NEEDS_APPROVAL:
      case ReviewStatus.NEEDS_REVIEW:
        return "pause-circle";
    }
  }

  public renderTime(time: number) {
    const d = new Date(time);
    const now = new Date();

    const locale = navigator.language || "en";
    const dateTimeFormat = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric"
    });

    const timeFormat = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "numeric"
    });

    const onSameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (onSameDay) {
      return timeFormat.format(d);
    } else {
      return dateTimeFormat.format(d);
    }
  }
}
</script>

<style lang="postcss"></style>
