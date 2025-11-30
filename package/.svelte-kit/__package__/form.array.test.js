import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RuneForm } from './RuneForm.svelte.js';
describe('RuneForm Array Touched State', () => {
    const itemSchema = z.object({
        id: z.number(),
        name: z.string(),
        details: z.object({
            description: z.string(),
            price: z.number()
        })
    });
    const formSchema = z.object({
        items: z.array(itemSchema),
        tags: z.array(z.string())
    });
    it('should track touched state for nested objects in arrays', () => {
        const form = RuneForm.fromSchema(formSchema, {
            items: [
                { id: 1, name: 'Item 1', details: { description: 'Desc 1', price: 10 } },
                { id: 2, name: 'Item 2', details: { description: 'Desc 2', price: 20 } }
            ],
            tags: ['tag1', 'tag2']
        });
        // Modify a nested property in an array element
        form.data.items[0].name = 'Updated Item 1';
        expect(form.touched['items.0.name']).toBe(true);
        // Modify a deeply nested property
        form.data.items[0].details.price = 15;
        expect(form.touched['items.0.details.price']).toBe(true);
        // Other items should not be touched
        expect(form.touched['items.1.name']).toBeFalsy();
        expect(form.touched['items.1.details.price']).toBeFalsy();
    });
    it('should preserve touched state when array is replaced entirely', () => {
        const form = RuneForm.fromSchema(formSchema, {
            items: [
                { id: 1, name: 'Item 1', details: { description: 'Desc 1', price: 10 } },
                { id: 2, name: 'Item 2', details: { description: 'Desc 2', price: 20 } }
            ],
            tags: ['tag1', 'tag2']
        });
        // Touch some fields
        form.data.items[0].name = 'Modified';
        form.data.items[1].details.price = 25;
        expect(form.touched['items.0.name']).toBe(true);
        expect(form.touched['items.1.details.price']).toBe(true);
        // Replace the entire array
        const newItems = [
            { id: 1, name: 'Modified', details: { description: 'Desc 1', price: 10 } },
            { id: 2, name: 'Item 2', details: { description: 'Desc 2', price: 25 } },
            { id: 3, name: 'Item 3', details: { description: 'Desc 3', price: 30 } }
        ];
        form.data.items = newItems;
        // The array itself should be marked as touched
        expect(form.touched['items']).toBe(true);
        // Previously touched nested fields should remain touched if their values changed
        expect(form.touched['items.0.name']).toBe(true);
        expect(form.touched['items.1.details.price']).toBe(true);
    });
    it('should track touched state when using array methods on nested arrays', () => {
        const form = RuneForm.fromSchema(formSchema, {
            items: [{ id: 1, name: 'Item 1', details: { description: 'Desc 1', price: 10 } }],
            tags: ['tag1', 'tag2']
        });
        // Touch a field in the first item
        form.data.items[0].name = 'Modified Item';
        expect(form.touched['items.0.name']).toBe(true);
        // Push a new item
        form.push('items', { id: 2, name: 'Item 2', details: { description: 'Desc 2', price: 20 } });
        // Previous touched state should be preserved
        expect(form.touched['items.0.name']).toBe(true);
        // The array itself should be touched
        expect(form.touched['items']).toBe(true);
        // New item fields should not be touched
        expect(form.touched['items.1.name']).toBeFalsy();
    });
    it('should track touched state when swapping array elements', () => {
        const form = RuneForm.fromSchema(formSchema, {
            items: [
                { id: 1, name: 'Item 1', details: { description: 'Desc 1', price: 10 } },
                { id: 2, name: 'Item 2', details: { description: 'Desc 2', price: 20 } }
            ],
            tags: []
        });
        // Touch fields in both items
        form.data.items[0].name = 'Modified 1';
        form.data.items[1].details.price = 25;
        expect(form.touched['items.0.name']).toBe(true);
        expect(form.touched['items.1.details.price']).toBe(true);
        // Swap the items
        form.swap('items', 0, 1);
        // Touched state should follow the swapped items
        expect(form.touched['items.1.name']).toBe(true); // Was at index 0
        expect(form.touched['items.0.details.price']).toBe(true); // Was at index 1
    });
    it('should track touched state when using splice', () => {
        const form = RuneForm.fromSchema(formSchema, {
            items: [
                { id: 1, name: 'Item 1', details: { description: 'Desc 1', price: 10 } },
                { id: 2, name: 'Item 2', details: { description: 'Desc 2', price: 20 } },
                { id: 3, name: 'Item 3', details: { description: 'Desc 3', price: 30 } }
            ],
            tags: []
        });
        // Touch some fields
        form.data.items[0].name = 'Modified 1';
        form.data.items[2].details.price = 35;
        expect(form.touched['items.0.name']).toBe(true);
        expect(form.touched['items.2.details.price']).toBe(true);
        // Remove the middle item
        form.splice('items', 1, 1);
        // First item's touched state should remain
        expect(form.touched['items.0.name']).toBe(true);
        // Third item (now at index 1) should retain its touched state
        expect(form.touched['items.1.details.price']).toBe(true);
        // Old index 2 should not have touched state
        expect(form.touched['items.2.details.price']).toBeFalsy();
    });
    it('should track touched state for primitive arrays', () => {
        const form = RuneForm.fromSchema(formSchema, {
            items: [],
            tags: ['tag1', 'tag2', 'tag3']
        });
        // Modify a tag
        form.data.tags[1] = 'modified-tag';
        expect(form.touched['tags.1']).toBe(true);
        expect(form.touched['tags.0']).toBeFalsy();
        expect(form.touched['tags.2']).toBeFalsy();
        // Replace the entire tags array
        form.data.tags = ['new1', 'modified-tag', 'new3'];
        expect(form.touched['tags']).toBe(true);
        // Previously touched element should remain touched
        expect(form.touched['tags.1']).toBe(true);
    });
    it('should clear touched state on reset', () => {
        const form = RuneForm.fromSchema(formSchema, {
            items: [{ id: 1, name: 'Item 1', details: { description: 'Desc 1', price: 10 } }],
            tags: ['tag1']
        });
        // Touch multiple fields
        form.data.items[0].name = 'Modified';
        form.data.items[0].details.price = 15;
        form.data.tags[0] = 'modified-tag';
        expect(form.touched['items.0.name']).toBe(true);
        expect(form.touched['items.0.details.price']).toBe(true);
        expect(form.touched['tags.0']).toBe(true);
        // Reset the form
        form.reset();
        // All touched states should be cleared
        expect(form.touched['items.0.name']).toBeFalsy();
        expect(form.touched['items.0.details.price']).toBeFalsy();
        expect(form.touched['tags.0']).toBeFalsy();
        expect(Object.keys(form.touched).length).toBe(0);
    });
    it('should handle complex nested array mutations', () => {
        const complexSchema = z.object({
            groups: z.array(z.object({
                name: z.string(),
                members: z.array(z.object({
                    id: z.number(),
                    name: z.string(),
                    roles: z.array(z.string())
                }))
            }))
        });
        const form = RuneForm.fromSchema(complexSchema, {
            groups: [
                {
                    name: 'Group 1',
                    members: [
                        { id: 1, name: 'Member 1', roles: ['admin', 'user'] },
                        { id: 2, name: 'Member 2', roles: ['user'] }
                    ]
                }
            ]
        });
        // Touch deeply nested fields
        form.data.groups[0].members[0].name = 'Updated Member';
        form.data.groups[0].members[0].roles[0] = 'superadmin';
        expect(form.touched['groups.0.members.0.name']).toBe(true);
        expect(form.touched['groups.0.members.0.roles.0']).toBe(true);
        // Add a new member
        form.data.groups[0].members.push({ id: 3, name: 'Member 3', roles: ['guest'] });
        // Previous touched states should be preserved
        expect(form.touched['groups.0.members.0.name']).toBe(true);
        expect(form.touched['groups.0.members.0.roles.0']).toBe(true);
        // Array should be touched
        expect(form.touched['groups.0.members']).toBe(true);
    });
    it('should track touched state when modifying object after array reassignment', () => {
        const form = RuneForm.fromSchema(formSchema, {
            items: [{ id: 1, name: 'Item 1', details: { description: 'Desc 1', price: 10 } }],
            tags: []
        });
        // Replace array with new array
        form.data.items = [{ id: 2, name: 'Item 2', details: { description: 'Desc 2', price: 20 } }];
        // The array itself should be touched
        expect(form.touched['items']).toBe(true);
        // Now modify a field in the new array
        form.data.items[0].name = 'Modified Item 2';
        expect(form.touched['items.0.name']).toBe(true);
        // Modify a deeply nested field
        form.data.items[0].details.price = 25;
        expect(form.touched['items.0.details.price']).toBe(true);
    });
    it('should handle array element replacement', () => {
        const form = RuneForm.fromSchema(formSchema, {
            items: [
                { id: 1, name: 'Item 1', details: { description: 'Desc 1', price: 10 } },
                { id: 2, name: 'Item 2', details: { description: 'Desc 2', price: 20 } }
            ],
            tags: []
        });
        // Touch a field in the first item
        form.data.items[0].name = 'Modified';
        expect(form.touched['items.0.name']).toBe(true);
        // Replace the entire first element
        form.data.items[0] = { id: 3, name: 'Item 3', details: { description: 'Desc 3', price: 30 } };
        // The element path should be touched
        expect(form.touched['items.0']).toBe(true);
        // Previous nested touched state should be cleared since it's a new object
        // But the parent path should still be touched
        expect(form.touched['items.0']).toBe(true);
    });
});
