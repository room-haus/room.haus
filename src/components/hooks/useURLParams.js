import {useState, useEffect} from 'react';

export default (search) => {
  const [params, setParams] = useState(new URLSearchParams(search));

  useEffect(() => {
    const urlParams = new URLSearchParams(search);
    setParams(urlParams);
  }, [search]);

  return params;
};
