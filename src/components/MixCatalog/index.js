import React from 'react';
import CatalogHeader from './CatalogHeader';
import CatalogList from './CatalogList';
import {mixes} from '../../content/mixes';

export default () => (
  <>
    <CatalogHeader />
    <CatalogList mixes={mixes} />
  </>
);
