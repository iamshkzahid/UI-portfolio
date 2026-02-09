const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// --- Mock DOM Implementation ---

class DOMTokenList {
    constructor() {
        this.tokens = new Set();
    }
    add(token) { this.tokens.add(token); }
    remove(token) { this.tokens.delete(token); }
    toggle(token) {
        if (this.tokens.has(token)) {
            this.tokens.delete(token);
            return false;
        } else {
            this.tokens.add(token);
            return true;
        }
    }
    contains(token) { return this.tokens.has(token); }
}

class CSSStyleDeclaration {
    constructor() {
        this._properties = {};
    }
    set display(val) { this._properties['display'] = val; }
    get display() { return this._properties['display']; }

    set opacity(val) { this._properties['opacity'] = val; }
    get opacity() { return this._properties['opacity']; }
}

class HTMLElement {
    constructor(tagName, id = '', className = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.className = className;
        this.classList = new DOMTokenList();
        if (className) {
            className.split(' ').forEach(c => this.classList.add(c));
        }
        this.style = new CSSStyleDeclaration();
        this.attributes = {};
        this.eventListeners = {};
        this.children = [];
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    addEventListener(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    dispatchEvent(event) {
        if (this.eventListeners[event.type]) {
            this.eventListeners[event.type].forEach(cb => cb.call(this, event));
        }
    }

    // Stub for scrollIntoView
    scrollIntoView(options) {
        this._scrolledIntoView = options;
    }
}

class Document {
    constructor() {
        this.eventListeners = {};
        this.elements = {}; // Map selector -> HTMLElement or [HTMLElement]
    }

    addEventListener(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    dispatchEvent(event) {
        if (this.eventListeners[event.type]) {
            this.eventListeners[event.type].forEach(cb => cb(event));
        }
    }

    querySelector(selector) {
        if (selector === '.hamburger') return this.elements['.hamburger'];
        if (selector === '.nav-links') return this.elements['.nav-links'];
        if (selector.startsWith('#')) return this.elements[selector];
        return null;
    }

    querySelectorAll(selector) {
        if (this.elements[selector]) {
            return Array.isArray(this.elements[selector]) ? this.elements[selector] : [this.elements[selector]];
        }
        return [];
    }

    // Helper to setup mock elements for tests
    _setElements(selector, elements) {
        this.elements[selector] = elements;
    }
}

class IntersectionObserverMock {
    constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        this.observations = [];
    }
    observe(target) {
        this.observations.push(target);
    }
    unobserve(target) {
        const index = this.observations.indexOf(target);
        if (index > -1) {
            this.observations.splice(index, 1);
        }
    }
    // Helper to simulate intersection
    _simulateIntersection(entry) {
        this.callback([entry], this);
    }
}

// --- Test Setup ---

const scriptContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

test('script.js integration tests', async (t) => {

    // Create fresh DOM for each sub-test if possible, but VM context re-use is tricky with global listeners.
    // For simplicity, we'll setup one context and run subtests that check different parts.

    const doc = new Document();

    // Setup Mock Elements

    // 1. Navigation Links for Smooth Scroll
    const navLink = new HTMLElement('a');
    navLink.setAttribute('href', '#projects');
    const projectSection = new HTMLElement('section', 'projects');
    doc._setElements('a[href^="#"]', [navLink]);
    doc._setElements('#projects', projectSection);

    // 2. Sections for Fade-in
    const aboutSection = new HTMLElement('section', 'about');
    doc._setElements('section', [projectSection, aboutSection]);

    // 3. Skills Filter
    const btnAll = new HTMLElement('button');
    btnAll.classList.add('skill-btn');
    btnAll.classList.add('active');
    btnAll.setAttribute('data-filter', 'all');

    const btnJs = new HTMLElement('button');
    btnJs.classList.add('skill-btn');
    btnJs.setAttribute('data-filter', 'javascript');

    const card1 = new HTMLElement('div');
    card1.classList.add('project-card');
    card1.setAttribute('data-category', 'javascript html css');

    const card2 = new HTMLElement('div');
    card2.classList.add('project-card');
    card2.setAttribute('data-category', 'html css');

    doc._setElements('.skill-btn', [btnAll, btnJs]);
    doc._setElements('.project-card', [card1, card2]);

    // 4. Hamburger Menu
    const hamburger = new HTMLElement('div');
    hamburger.classList.add('hamburger');
    const navMenu = new HTMLElement('ul');
    navMenu.classList.add('nav-links');
    const menuLink = new HTMLElement('a');

    doc._setElements('.hamburger', hamburger);
    doc._setElements('.nav-links', navMenu);
    doc._setElements('.nav-links li a', [menuLink]);

    // Create Context
    const context = {
        document: doc,
        window: {},
        IntersectionObserver: IntersectionObserverMock,
        HTMLElement: HTMLElement,
        console: console,
        setTimeout: (cb, delay) => cb() // Immediate execution for tests
    };

    vm.createContext(context);
    vm.runInContext(scriptContent, context);

    // Trigger DOMContentLoaded
    await t.test('Initializes on DOMContentLoaded', () => {
        assert.strictEqual(doc.eventListeners['DOMContentLoaded'].length, 1, 'Should add DOMContentLoaded listener');

        // Trigger the listener
        doc.dispatchEvent({ type: 'DOMContentLoaded' });

        // Check initial state set by script
        // Sections should have 'hidden' class and be observed
        assert.ok(projectSection.classList.contains('hidden'), 'Section should be initially hidden');
        assert.ok(aboutSection.classList.contains('hidden'), 'Section should be initially hidden');
    });

    await t.test('Smooth Scrolling', () => {
        // Trigger click on nav link
        const clickEvent = { type: 'click', preventDefault: () => {} };
        // We need to capture if preventDefault was called
        let defaultPrevented = false;
        clickEvent.preventDefault = () => { defaultPrevented = true; };

        navLink.dispatchEvent(clickEvent);

        assert.strictEqual(defaultPrevented, true, 'Should prevent default link behavior');
        // Check properties individually to avoid VM context prototype issues
        assert.ok(projectSection._scrolledIntoView, 'scrollIntoView should be called');
        assert.strictEqual(projectSection._scrolledIntoView.behavior, 'smooth', 'Should scroll smoothly');
    });

    await t.test('Skills Filtering', () => {
        // Initial state: both visible (assumed, or handled by CSS, but script logic sets display)
        // Script logic: click 'javascript' button

        const clickEvent = { type: 'click' };
        btnJs.dispatchEvent(clickEvent);

        // Check button active state
        assert.ok(btnJs.classList.contains('active'), 'Clicked button should be active');
        assert.ok(!btnAll.classList.contains('active'), 'Other button should not be active');

        // Check filtering logic
        // Card 1 (js, html, css) -> Should match 'javascript' -> display: flex
        // Card 2 (html, css) -> Should NOT match 'javascript' -> display: none

        assert.strictEqual(card1.style.display, 'flex', 'Matching card should be visible');
        assert.strictEqual(card2.style.display, 'none', 'Non-matching card should be hidden');

        // Click 'all'
        btnAll.dispatchEvent(clickEvent);
        assert.strictEqual(card1.style.display, 'flex', 'All: Card 1 visible');
        assert.strictEqual(card2.style.display, 'flex', 'All: Card 2 visible');
    });

    await t.test('Hamburger Menu', () => {
        const clickEvent = { type: 'click' };

        // Toggle Open
        hamburger.dispatchEvent(clickEvent);
        assert.ok(hamburger.classList.contains('active'), 'Hamburger should have active class');
        assert.ok(navMenu.classList.contains('active'), 'Nav menu should have active class');

        // Toggle Close
        hamburger.dispatchEvent(clickEvent);
        assert.ok(!hamburger.classList.contains('active'), 'Hamburger should not have active class');
        assert.ok(!navMenu.classList.contains('active'), 'Nav menu should not have active class');

        // Open again then click link to close
        hamburger.dispatchEvent(clickEvent);
        menuLink.dispatchEvent(clickEvent);
        assert.ok(!hamburger.classList.contains('active'), 'Hamburger should close on link click');
        assert.ok(!navMenu.classList.contains('active'), 'Nav menu should close on link click');
    });
});
