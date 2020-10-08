<template>
  <!-- TODO: Some of these classes should be outside -->
  <div
    class="flex items-center bg-dark-3 px-4 py-2 mb-4 border-dark-0 shadow dark-shadow rounded"
  >
    <router-link :to="`/pr/${item.owner}/${item.repo}/${item.number}`">
      <span
        :class="statusTextColor(item.status)"
        class="text-lg font-bold mr-4"
      >
        <font-awesome-icon :icon="statusIcon(item.status)" class="mr-2" />
        <span class="text-lg">{{ itemText(item) }}</span>
      </span>
      <span class="text-lg mr-2">{{ item.title }}</span>
    </router-link>
    <span class="flex-grow"><!-- spacer --></span>
    <span class="text-md"
      ><font-awesome-icon icon="history" class="mr-1" />{{
        renderTime(item.updated)
      }}</span
    >
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { InboxItemData, Status, itemSlug } from "../../model/inbox";

@Component({
  components: {}
})
export default class InboxItem extends Vue {
  @Prop() public item!: InboxItemData;

  async mounted() {}

  public itemText(item: InboxItemData) {
    return itemSlug(item);
  }

  public statusTextColor(status: Status) {
    switch (status) {
      case "approved":
        return "text-green-400";
      case "pending":
        return "text-yellow-400";
      case "merged":
        return "text-blue-500";
    }
  }

  public statusIcon(status: Status) {
    switch (status) {
      case "approved":
        return "check";
      case "pending":
        return "pause-circle";
      case "merged":
        return "code-branch";
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
