import assert from 'node:assert/strict';
import {LetterUnlock,LETTER_PARAGRAPHS} from '../dist/keepsake-letter.js';
const data=new Map(),store={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
let letter=new LetterUnlock(store);assert.equal(letter.unlocked,false);assert.equal(letter.discover(),true);assert.equal(letter.discover(),false);
letter=new LetterUnlock(store);assert.equal(letter.unlocked,true);assert.equal(letter.discover(),false);
data.set('beluga-wardrobe-v1','{"extras":[]}');assert(new LetterUnlock(store).unlocked,'Removing the bag or changing looks cannot relock the letter');
const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};letter=new LetterUnlock(blocked);assert(letter.discover());assert(letter.unlocked);assert.equal(letter.discover(),false);
assert.equal(LETTER_PARAGRAPHS.length,4);assert(LETTER_PARAGRAPHS[0].includes('Congratulations on finding THE SALAMI.'));assert(LETTER_PARAGRAPHS[1].endsWith('syringes ehehehe'));assert(LETTER_PARAGRAPHS[3].endsWith('and to us.'));
console.log('PASS: first discovery only, permanent browser unlock, bag-independent persistence, unavailable-storage fallback, original message copy');
