import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";

const base = import.meta.env.VITE_ROUTER_BASE || "/";

export default createRouter({
  history: createWebHistory(base),
  routes: [
    { path: "/", component: Home },
    { path: "/playground", component: () => import("../views/Playground.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
