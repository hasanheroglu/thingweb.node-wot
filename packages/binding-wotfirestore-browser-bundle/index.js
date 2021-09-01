"use strict";

const BindingWoTFirestore = require("@node-wot/binding-wotfirestore");

if (typeof window !== "undefined") {
    window.BindingWoTFirestore = BindingWoTFirestore;
} else if (typeof module !== "undefined" && module.exports) {
    module.exports = BindingWoTFirestore;
}