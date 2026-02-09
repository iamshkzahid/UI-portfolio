const { test, describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// -----------------------------------------------------------------------------
// MOCK DOM IMPLEMENTATION
// -----------------------------------------------------------------------------

class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(c) { this.classes.add(c); }
  remove(c) { this.classes.delete(c); }
  toggle(c) {
    if (this.classes.has(c)) this.classes.delete(c);
    else this.classes.add(c);
  }
  contains(c) { return this.classes.has(c); }
  toString() { return Array.from(this.classes).join(' '); }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList();
    this.style = {};
    this.attributes = new Map();
    this.eventListeners = {};
    this.textContent = '';
  }

  getAttribute(name) { return this.attributes.get(name) || null; }
  setAttribute(name, value) { this.attributes.set(name, value); }

  addEventListener(event, callback) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(callback);
  }

  click() {
    if (this.eventListeners['click']) {
      // Mock event object
      const event = {
        preventDefault: () => {},
        target: this
      };
      this.eventListeners['click'].forEach(cb => cb.call(this, event));
    }
  }

  scrollIntoView() {}
}

class MockDocument {
  constructor() {
    this.elements = [];
    this.eventListeners = {};
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  querySelector(selector) {
    // Basic selector matching for ID and Class
    return this.elements.find(el => this._matches(el, selector)) || null;
  }

  querySelectorAll(selector) {
    return this.elements.filter(el => this._matches(el, selector));
  }

  addEventListener(event, callback) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(callback);
  }

  // Helper to add elements to our "DOM"
  _add(element) {
    this.elements.push(element);
    return element;
  }

  _matches(element, selector) {
    // Complex selector: .nav-links li a
    if (selector === '.nav-links li a') {
        return element.tagName === 'A' && element._isNavLink;
    }

    if (selector.startsWith('#')) {
      return element.getAttribute('id') === selector.substring(1);
    }
    // Class selector (simple, no spaces)
    if (selector.startsWith('.') && !selector.includes(' ')) {
      return element.classList.contains(selector.substring(1));
    }
    if (selector.includes('[href^="#"]')) {
        const href = element.getAttribute('href');
        return href && href.startsWith('#');
    }
    // Tag name matching
    if (/^[A-Za-z]+$/.test(selector)) {
        return element.tagName === selector.toUpperCase();
    }
    return false;
  }
}

class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe(element) {}
  unobserve(element) {}
}

// Global setup
global.window = {};
global.document = new MockDocument();
global.IntersectionObserver = MockIntersectionObserver;
global.HTMLElement = MockElement;

// Import the script to test
// Note: We need to require it AFTER globals are set, but since it exports a function,
// we can require it once. The function `initPortfolio` uses the globals when called.
const { initPortfolio } = require('../script.js');

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

describe('Portfolio Script Logic', () => {

  beforeEach(() => {
    // Reset document elements before each test
    global.document.elements = [];
  });

  it('should toggle hamburger menu active class on click', () => {
    // Setup DOM
    const hamburger = new MockElement('div');
    hamburger.classList.add('hamburger');
    global.document._add(hamburger);

    const navMenu = new MockElement('ul');
    navMenu.classList.add('nav-links');
    global.document._add(navMenu);

    // Run initialization
    initPortfolio();

    // Verify initial state
    assert.strictEqual(hamburger.classList.contains('active'), false, 'Hamburger should not be active initially');
    assert.strictEqual(navMenu.classList.contains('active'), false, 'Nav menu should not be active initially');

    // Simulate click
    hamburger.click();

    // Verify toggled state
    assert.strictEqual(hamburger.classList.contains('active'), true, 'Hamburger should be active after click');
    assert.strictEqual(navMenu.classList.contains('active'), true, 'Nav menu should be active after click');

    // Simulate click again
    hamburger.click();

    // Verify toggled off
    assert.strictEqual(hamburger.classList.contains('active'), false, 'Hamburger should not be active after second click');
    assert.strictEqual(navMenu.classList.contains('active'), false, 'Nav menu should not be active after second click');
  });

  it('should close hamburger menu when a nav link is clicked', () => {
    // Setup DOM
    const hamburger = new MockElement('div');
    hamburger.classList.add('hamburger');
    hamburger.classList.add('active'); // Start open
    global.document._add(hamburger);

    const navMenu = new MockElement('ul');
    navMenu.classList.add('nav-links');
    navMenu.classList.add('active'); // Start open
    global.document._add(navMenu);

    const navLink = new MockElement('a');
    navLink._isNavLink = true; // Helper for our mock selector
    navLink.setAttribute('href', '#about');
    global.document._add(navLink);

    // Run initialization
    initPortfolio();

    // Simulate link click
    navLink.click();

    // Verify closed
    assert.strictEqual(hamburger.classList.contains('active'), false, 'Hamburger should close on link click');
    assert.strictEqual(navMenu.classList.contains('active'), false, 'Nav menu should close on link click');
  });

  it('should filter projects correctly', () => {
    // Setup DOM
    const allBtn = new MockElement('button');
    allBtn.classList.add('skill-btn');
    allBtn.setAttribute('data-filter', 'all');
    allBtn.classList.add('active');
    global.document._add(allBtn);

    const jsBtn = new MockElement('button');
    jsBtn.classList.add('skill-btn');
    jsBtn.setAttribute('data-filter', 'javascript');
    global.document._add(jsBtn);

    const project1 = new MockElement('div');
    project1.classList.add('project-card');
    project1.setAttribute('data-category', 'javascript html css');
    project1.style.display = 'flex';
    global.document._add(project1);

    const project2 = new MockElement('div');
    project2.classList.add('project-card');
    project2.setAttribute('data-category', 'html css');
    project2.style.display = 'flex';
    global.document._add(project2);

    // Run initialization
    initPortfolio();

    // Click "JavaScript" filter
    jsBtn.click();

    // Verify buttons state
    assert.strictEqual(jsBtn.classList.contains('active'), true, 'JS button should be active');
    assert.strictEqual(allBtn.classList.contains('active'), false, 'All button should be inactive');

    // Verify projects visibility
    // Note: implementation sets display to 'flex' or 'none'
    assert.strictEqual(project1.style.display, 'flex', 'Project 1 (JS) should be visible');
    assert.strictEqual(project2.style.display, 'none', 'Project 2 (HTML/CSS only) should be hidden');

    // Click "All" filter
    allBtn.click();

    assert.strictEqual(project1.style.display, 'flex', 'Project 1 should be visible on All');
    assert.strictEqual(project2.style.display, 'flex', 'Project 2 should be visible on All');
  });

  it('should initialize IntersectionObserver for sections', () => {
      // Setup DOM
      const section = new MockElement('section');
      global.document._add(section);

      // We need to spy on IntersectionObserver
      let observedElements = [];
      const OriginalObserver = global.IntersectionObserver;
      global.IntersectionObserver = class SpyObserver {
          constructor(cb) {}
          observe(el) { observedElements.push(el); }
          unobserve() {}
      };

      initPortfolio();

      assert.strictEqual(section.classList.contains('hidden'), true, 'Section should have hidden class');
      assert.strictEqual(observedElements.includes(section), true, 'Section should be observed');

      // Restore
      global.IntersectionObserver = OriginalObserver;
  });

});
