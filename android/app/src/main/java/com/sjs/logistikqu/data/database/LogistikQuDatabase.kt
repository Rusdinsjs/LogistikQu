package com.sjs.logistikqu.data.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.sjs.logistikqu.data.database.dao.InventoryCacheDao
import com.sjs.logistikqu.data.database.dao.LocalTransactionDao
import com.sjs.logistikqu.data.database.dao.PhotoUploadQueueDao
import com.sjs.logistikqu.data.database.dao.SyncQueueDao
import com.sjs.logistikqu.data.database.entities.InventoryCacheEntity
import com.sjs.logistikqu.data.database.entities.LocalTransactionEntity
import com.sjs.logistikqu.data.database.entities.PhotoUploadQueueEntity
import com.sjs.logistikqu.data.database.entities.SyncQueueEntity

@Database(
    entities = [
        InventoryCacheEntity::class,
        SyncQueueEntity::class,
        LocalTransactionEntity::class,
        PhotoUploadQueueEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class LogistikQuDatabase : RoomDatabase() {
    abstract fun inventoryCacheDao(): InventoryCacheDao
    abstract fun syncQueueDao(): SyncQueueDao
    abstract fun localTransactionDao(): LocalTransactionDao
    abstract fun photoUploadQueueDao(): PhotoUploadQueueDao
}
