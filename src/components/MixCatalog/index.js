import React from 'react';
import CatalogHeader from './CatalogHeader';
import CatalogList from './CatalogList';
import {mixes} from '../../content/mixes';

console.log(mixes);
export default () => (
  <>
    <CatalogHeader />
    <CatalogList mixes={mixes} />
  </>
);
