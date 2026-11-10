import type { ReactElement } from 'react';
import type { LibraryDoc } from '../../data/libraryCatalog';
import { CATEGORY_LABEL } from '../../data/libraryCatalog';
import styles from './DocCover.module.css';

/** Generated cover — no image assets; tint follows the category, all inside the Regnix purple palette. */
export function DocCover({ doc, size = 'md' }: { doc: LibraryDoc; size?: 'sm' | 'md' | 'lg' }): ReactElement {
  return (
    <div className={`${styles.cover} ${styles[doc.category]} ${styles[size]}`} aria-hidden="true">
      <span className={styles.spine} />
      <span className={styles.cat}>{CATEGORY_LABEL[doc.category]}</span>
      <span className={styles.name}>{doc.shortTitle}</span>
      <span className={styles.year}>{doc.year}</span>
      <span className={styles.fmt}>{doc.format === 'pdf' ? 'PDF' : 'TEXT'}</span>
    </div>
  );
}
