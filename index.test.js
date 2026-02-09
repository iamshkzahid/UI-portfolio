/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');

describe('index.html', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html.toString();
  });

  test('has the correct title', () => {
    expect(document.title).toBe('INDEX');
  });

  test('has an h1 with correct text', () => {
    const h1 = document.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1.textContent).toBe('My Portfolio');
  });

  test('h1 has the correct class', () => {
    const h1 = document.querySelector('h1');
    expect(h1.classList.contains('heading')).toBe(true);
  });
});
