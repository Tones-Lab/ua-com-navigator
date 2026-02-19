INSERT INTO Events 
(
	Ack,AckBy,AckTime,Action,Actor,AdditionalInfo,AlarmCategorization1,AlarmCategorization2,AlarmCode,CAPEFlag,
	CMDBCIEnvironment,CMDBCIID,CMDBCIStatus,CMDBServiceID,ClearOrderKey,ClearTime,Company,Count,Customer,Department,
	Details,DeviceType,Duration,EMSAlarmID,EMSHost,EMSHostGroup,EMSIPAddress,EMSName,EMSService,EscalationFlag,
	EventCategory,EventKey,EventType,ExpireTime,FirstReported,GeoLocation,GeoPath,HelpKey,IPAddress,LastChanged,
	LastComment,LastReported,Location,Method,MsgGroup,NECard,NECluster,NEFirstReported,NELastReported,NEMilestone,
	NEMilestoneDescription,NEName,NEPort,NERNC,NERegion,NEShelf,NESlot,NETHS,Node,NodeAlias,
	OnCall,OrigSeverity,OwnedTime,OwnerName,ResendInterval,RootCauseFlag,RootCauseID,Score,Service,ServiceImpact,
	Severity,SubDeviceType,SubMethod,SubNode,Summary,Suppression,SuppressionList,Technology,TicketActionType,TicketAssignedGroup,
	TicketCategoryLevel1,TicketCategoryLevel2,TicketCategoryLevel3,TicketCustomerService,TicketEntryID,TicketFlag,TicketFollowUpTime,TicketID,TicketNotes,TicketRelatedIncNr,
	TicketRelationType,TicketSeverity,TicketStatus,TicketStatusReason,TicketSubmitTime,TicketSubmitter,TicketSystem,TicketUrgency,TicketVendor,TicketVendorTicketID,
	VisibleTime,ZoneID
)
VALUES 
(
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,ST_GeomFromGeoJson(?,1,4326),ST_GeomFromGeoJson(?,1,4326),?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?
) as new
ON DUPLICATE KEY UPDATE
     Actor = new.Method,
     Action = if(Events.Severity = new.Severity,							/* Default is "Insert" set on EventDefaults. */
                 'Deduplication',                                           /* Severity did not change */
                 'DeduplicationWithSevChange'                               /* Severity changed */
                 ),
     ClearOrderKey = new.ClearOrderKey,
     ClearTime = if(Events.EventCategory = 11, 								/*  For STATUS Events  */
                    case
                        when Events.Severity > 0 and new.Severity = 0 then  /*  If Event is cleared */
                            unix_timestamp(curtime(3))                  	/*  set ClearTime */
                        when new.Severity = 0 then                 		 	/* If Clear deduplicates */
                            Events.ClearTime                                /* keep existing ClearTime */
                    /* else null (default) */                       		/* remove ClearTime */
                        end,
                    if(Events.Severity = 0 and new.Severity > 0, 			/*  All other Events, if event is Awake again, */
                       null, 												/*  remove ClearTime */
                       Events.ClearTime 									/*  keep Existing ClearTime */
                    )
                 ),
     Count = Events.Count + 1,
     Duration = new.LastReported - Events.FirstReported,
     EMSAlarmID = new.EMSAlarmID,
     EventCategory  = if (Events.EventCategory = 3 and new.EventCategory = 1,   /* check handled resolutions */
                          new.EventCategory,          							/* update EventCategory for resolutions as mechanization updates it. */
                          Events.EventCategory                   				/* keep existing EventCategory */
                      ),
     ExpireTime = new.ExpireTime,
     LastChanged  = unix_timestamp(curtime(3)),
     LastReported = new.LastReported,
     NELastReported = new.NELastReported,
     Severity =  if(Events.EventCategory = 11,								/* For STATUS Events  */
                    new.Severity,											/* Always Update to new Severity */
                    if(Events.Severity = 0 AND new.Severity > 0,			/* For all other Events when old Severity=0 and new Severity > 0 -> Re-Awake the Event */
                       new.Severity,										/* update Severity */
                       Events.Severity										/* Else: Keep original Severity */
                    )
                 ),
     Summary =   if (Events.Summary like 'Review Required: %',
                     concat('Review Required: ', new.Summary),
                     new.Summary
                 ),
     SuppressionList = if (JSON_CONTAINS_PATH(Events.SuppressionList, 'one', '$."Hidden from NOC"."Rules EMS Severity"') !=  JSON_CONTAINS_PATH(new.SuppressionList, 'one', '$."Hidden from NOC"."Rules EMS Severity"'),    /* "Rules EMS Severity" was added or removed */
                            if (JSON_CONTAINS_PATH(new.SuppressionList, 'one', '$."Hidden from NOC"."Rules EMS Severity"'),   /* "Rules EMS Severity" was added */
                                JSON_MERGE_PATCH(Events.SuppressionList, JSON_OBJECT('Hidden from NOC', JSON_OBJECT('Rules EMS Severity', JSON_EXTRACT(new.SuppressionList, '$."Hidden from NOC"."Rules EMS Severity"')))),   /* add "Rules EMS Severity" */
                                JSON_REMOVE(Events.SuppressionList, '$."Hidden from NOC"."Rules EMS Severity"')   /* remove "Rules EMS Severity" */
                            ),
                        Events.SuppressionList
                     ),
     SuppressionList = if ( ifnull(JSON_LENGTH(JSON_EXTRACT(Events.SuppressionList, '$."Hidden from NOC"')),0) = 0,  /* no more suppressions under "Hidden from NOC" */
                            JSON_REMOVE(Events.SuppressionList, '$."Hidden from NOC"'),         /* remove "Hidden from NOC" */
                            Events.SuppressionList
                     ),
     Suppression = if ( ifnull(JSON_LENGTH(JSON_EXTRACT(Events.SuppressionList, '$')),0) = 0,   /* no more suppressions at all */
                        0,     /* set Suppression to 0 */
                        1      /* set Suppression to 1 */
     ),
     SubNode = new.SubNode