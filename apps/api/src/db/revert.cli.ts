import {revertLast} from './migrate';

const name = await revertLast();
console.log(name ? `reverted ${name}` : 'nothing to revert');
