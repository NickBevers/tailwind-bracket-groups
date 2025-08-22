import { describe, it, expect } from 'vitest';
import { expandGroups } from '../src/index';

describe('expandGroups', () => {
    it('expands flat groupings', () => {
        const input = 'md:(pl-3 pt-2)';
        const output = expandGroups(input);
        expect(output).toBe('md:pl-3 md:pt-2');
    });

    it('expands multiple flat groupings', () => {
        const input = 'sm:(m-1 p-2) lg:(m-4 p-6)';
        const output = expandGroups(input);
        expect(output).toBe('sm:m-1 sm:p-2 lg:m-4 lg:p-6');
    });

    it('handles nested groups', () => {
        const input = 'hover:(bg-red-500 md:(pl-3 pt-2))';
        const output = expandGroups(input);
        expect(output).toBe('hover:bg-red-500 hover:md:pl-3 hover:md:pt-2');
    });

    it('handles deeply nested groups', () => {
        const input = 'focus:(hover:(md:(underline text-lg)))';
        const output = expandGroups(input);
        expect(output).toBe('focus:hover:md:underline focus:hover:md:text-lg');
    });

    it('handles plain classes without groups', () => {
        const input = 'text-center font-bold';
        const output = expandGroups(input);
        expect(output).toBe('text-center font-bold');
    });

    it('ignores extra whitespace', () => {
        const input = 'md:(   pl-3   pt-2  )';
        const output = expandGroups(input);
        expect(output).toBe('md:pl-3 md:pt-2');
    });
});
