<template>
  <div class="engine-content">
    <!-- Layered VN components -->
    <Background />
    <LocationOverlay />
    <ActionOverlay />
    <TopBarOverlay />
    <Drawing />
    <Foreground />
    <Dialogue />
    <Choice />
    <Custom />
  </div>
</template>

<script setup lang="ts">
import {
  Background,
  Choice,
  Dialogue,
  Drawing,
  Foreground
} from '@generate/components/core';
import {
  LocationOverlay,
  ActionOverlay,
  TopBarOverlay,
  Custom
} from '@generate/components/menu';
</script>

<style scoped>
.engine-content {
  width: 100%;
  height: 100%;
  background-color: #1a1a1a;
  overflow: hidden;
  position: relative; /* Ensure proper positioning context for children */
}
</style>
